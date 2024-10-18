import { MarkdownParser, type MarkdownParserConfig } from './markdown'
import { defaultKeymap, compileKeymap, type Keymap, type CompiledKeybind } from './keymap'
import { defaultBlockHideRules, defaultInlineGrammar, defaultLineGrammar } from './grammar'
import { defu, isFirefox } from './utils'

export interface EditorConfig {
	content: string
	readonly: boolean
	lineWrap: boolean
	tabSize: number
	indentWithSpaces: boolean
	convertIndentation: boolean
	hideMarks: boolean
	blockHideRules: Record<string, string>
	keymap: Keymap
	markdown: Partial<MarkdownParserConfig>
}

export interface EditorSelection {
	start: number
	end: number
}

export interface Line {
	num: number
	from: number
	end: number
	text: string
}

interface EditorState {
	focused: boolean
	composing: boolean
	compositionTime: number
	selection: EditorSelection & { direction: 'forward' | 'backward' | 'none' }
	timestamp: number
}

interface HistoryState {
	lines: string[]
	selection: EditorState['selection']
}

const defaultConfig: EditorConfig = {
	content: '',
	readonly: false,
	lineWrap: false,
	tabSize: 2,
	indentWithSpaces: false,
	convertIndentation: true,
	hideMarks: false,
	blockHideRules: defaultBlockHideRules,
	keymap: defaultKeymap,
	markdown: {
		lineGrammar: defaultLineGrammar,
		inlineGrammar: defaultInlineGrammar
	}
}

export class Editor {
	private listeners: Record<string, (() => any)[]> = {}
	private keymap: CompiledKeybind[]
	private handlers = {
		beforeinput: this.handleBeforeInput.bind(this),
		input: this.handleInput.bind(this),
		compositionstart: this.handleCompositionStart.bind(this),
		compositionend: this.handleCompositionEnd.bind(this),
		key: this.handleKey.bind(this),
		paste: this.handlePaste.bind(this),
		mousedown: this.handleMouseDown.bind(this),
		click: this.handleClick.bind(this),
		selection: this.handleSelection.bind(this)
	}
	private state: EditorState = {
		focused: false,
		composing: false,
		compositionTime: 0,
		selection: {
			start: 0,
			end: 0,
			direction: 'none'
		},
		timestamp: 0
	}
	private undoStack: HistoryState[] = []
	private redoStack: HistoryState[] = []
	readonly root: HTMLElement
	readonly config: EditorConfig
	/**
	 * The `MarkdownParser` instance the editor uses.
	 */
	readonly markdown: MarkdownParser

	/**
	 * The lines that the editor content consists of.
	 * If you modify this value, you need to call `editor.updateDOM()` manually.
	 */
	lines: string[] = []

	get content(): string {
		return this.lines.join('\n')
	}

	set content(content: string) {
		this.lines = this.convertIndentation(content).split('\n')

		// Update the DOM and move the cursor to the end
		this.updateDOM(Editor.selectionFrom(content.length))
	}

	get selection(): EditorSelection & { direction: 'forward' | 'backward' | 'none' } {
		return {
			start: this.state.selection.start,
			end: this.state.selection.end,
			direction: this.state.selection.direction
		}
	}

	/**
	 * Get if the editor is currently focused.
	 */
	get focused(): boolean {
		return this.root === document.activeElement
	}

	set readonly(readonly: boolean) {
		if (readonly)
			this.destroy()
		else
			this.setup()

		this.config.readonly = readonly
	}

	get readonly(): boolean {
		return this.config.readonly
	}

	/**
	 * Create a new `Editor` instance.
	 *
	 * @param root - The element on which the editor will be rendered.
	 * @param config - The configuration for the editor.
	 */
	constructor(root: HTMLElement | string, config?: Partial<EditorConfig>) {
		const element = typeof root === 'string'
			? document.getElementById(root)
			: root

		if (!element)
			throw Error('Could not create editor: Element does not exist')

		this.root = element
		this.config = defu(config, defaultConfig)
		this.keymap = compileKeymap(this.config.keymap)
		this.markdown = new MarkdownParser(this.config.markdown as MarkdownParserConfig)

		this.createEditorElement()

		this.content = this.config.content
	}

	private createEditorElement(): void {
		this.root.classList.add('md-editor')

		this.root.innerHTML = '<div class="md-line"><br></div>'

		// Important for whitespace formatting and to prevent the browser from replacing spaces with `&nbsp;`
		this.root.style.whiteSpace = this.config.lineWrap ? 'pre-wrap' : 'pre'
		this.root.style.tabSize = this.config.tabSize.toString()

		if (!this.config.readonly)
			this.setup()
	}

	private setup(): void {
		// Make the editor element editable
		this.root.setAttribute('contenteditable', 'true')

		// Prevent the rich formatting popup on iOS
		// @ts-expect-error
		this.root.style.webkitUserModify = 'read-write-plaintext-only'

		// Add event listeners
		this.root.addEventListener('beforeinput', this.handlers.beforeinput)
		this.root.addEventListener('input', this.handlers.input)
		this.root.addEventListener('compositionstart', this.handlers.compositionstart)
		this.root.addEventListener('compositionend', this.handlers.compositionend)
		this.root.addEventListener('keydown', this.handlers.key)
		this.root.addEventListener('paste', this.handlers.paste)
		this.root.addEventListener('mousedown', this.handlers.mousedown)
		this.root.addEventListener('click', this.handlers.click)
		document.addEventListener('selectionchange', this.handlers.selection)

		// Firefox doesn't fire the selectionchange event on focus / blur
		if (isFirefox) {
			this.root.addEventListener('focus', this.handlers.selection)
			this.root.addEventListener('blur', this.handlers.selection)
		}
	}

	private handleBeforeInput(event: InputEvent): void {
		if (event.inputType === 'deleteContentForward' || event.inputType === 'insertText') {
			if (this.selection.start !== this.selection.end) {
				event.preventDefault()
				this.insertAtSelection(event.data ?? '')
			}
		} else if (event.inputType.startsWith('history')) {
			event.preventDefault()

			if (event.inputType === 'historyUndo')
				this.undo()
			else if (event.inputType === 'historyRedo')
				this.redo()
		}
	}

	private handleInput(): void {
		// For composition input, only update the text after a `compositionend` event
		// Updating the DOM before that will cancel the composition
		if (this.state.composing)
			return

		this.updateLines()
		this.updateDOM()
	}

	private handleCompositionStart() {
		if (this.selection.start !== this.selection.end)
			this.insertAtSelection('')

		this.state.composing = true

		// WebKit destroys line elements after composition for some reason if they have `position: relative`
		const line = this.lineAt(this.selection.start)
		const lineElm = this.root.children[line.num] as HTMLDivElement

		lineElm.style.position = 'initial'
	}

	private handleCompositionEnd() {
		this.state.composing = false
		this.state.compositionTime = Date.now()

		this.handleInput()
	}

	private handleKey(event: KeyboardEvent): void {
		// Safari fires the compositionend event and keydown event for confirming the composition in the wrong order,
		// so any keydown event directly after composition is ignored
		if (this.state.composing || Date.now() - this.state.compositionTime <= 100)
			return

		for (const keybind of this.keymap) {
			if (
				event.key.toLowerCase() !== keybind.key
				|| event.ctrlKey !== keybind.ctrlKey
				|| event.metaKey !== keybind.metaKey
				|| event.shiftKey !== keybind.shiftKey
				|| event.altKey !== keybind.altKey
			)
				continue

			event.preventDefault()
			keybind.handler(this)
		}
	}

	private handlePaste(event: ClipboardEvent): void {
		event.preventDefault()

		if (!event.clipboardData)
			return

		const text = event.clipboardData.getData('text/plain')

		this.insertAtSelection(text)
	}

	private handleMouseDown(event: MouseEvent): void {
		if (this.toggleCheckbox(event, false))
			return

		// Workaround for a bug in Firefox where inline elements prevent line selection on tripleclick
		if (event.detail % 3 === 0) {
			event.preventDefault()

			const line = this.lineAt(this.selection.start)

			this.setSelection({ start: line.from, end: line.from + line.text.length })
		}
	}

	private handleClick(event: Event): void {
		this.toggleCheckbox(event)
	}

	private handleSelection(event: Event) {
		// Prevent updating twice when a selectionchange event follows setSelection
		if (event instanceof FocusEvent || Date.now() - this.state.timestamp > 10)
			this.updateState()
	}

	/**
	 * Read back the content from the DOM
	 */
	private updateLines(): void {
		// Remove elements that aren't editor lines
		for (const node of this.root.childNodes) {
			if (node instanceof HTMLDivElement && node.classList.contains('md-line')) {
				// Clean up from composition
				if (node.style.position === 'initial')
					node.style.removeProperty('position')

				continue
			}

			node.remove()
		}

		if (!this.root.firstChild)
			this.root.innerHTML = '<div class="md-line"><br></div>'

		this.lines = []

		// Using this.root.textContent directly doesn't include line breaks
		for (const lineElm of this.root.children)
			this.lines.push(lineElm.textContent ?? '')
	}

	/**
	 * Toggle TaskList checkboxes
	 */
	private toggleCheckbox(event: Event, act = true): boolean {
		if (!(event.target instanceof HTMLInputElement && event.target.matches('.md-task input[type="checkbox"]')))
			return false

		event.preventDefault()

		if (!act)
			return true

		const checkboxPos = this.getNodeOffset(event.target as Element)
		const line = this.lineAt(checkboxPos)
		const pos = checkboxPos - line.from + 3
		const text = line.text

		this.lines[line.num] = text.substring(0, pos)
			+ (text[pos] === ' ' ? 'x' : ' ')
			+ text.substring(pos + 1)

		if (!this.focused)
			this.root.focus()

		this.updateDOM(Editor.selectionFrom(line.end))

		return true
	}

	private updateState(selection = this.getSelection(), force = false): void {
		this.state.timestamp = Date.now()

		// Only update if the state changed
		if (
			!force
			&& !this.state.composing
			&& this.state.focused === this.focused
			&& this.state.selection.start === selection.start
			&& this.state.selection.end === selection.end
		)
			return

		// Update hidden Markdown syntax if the selection changed
		this.hideMarks(selection)

		// Update the selection of current state in the undo stack
		if (this.undoStack[this.undoStack.length - 1]) {
			this.undoStack[this.undoStack.length - 1].selection = {
				start: selection.start,
				end: selection.end,
				direction: selection.direction
			}
		}

		this.state.focused = this.focused
		this.state.selection.start = selection.start
		this.state.selection.end = selection.end
		this.state.selection.direction = selection.direction

		this.dispatchEvent('selectionchange')
	}

	/**
	 * Apply changes made to the editor content to the DOM.
	 * The Markdown parse function is called here.
	 *
	 * @param overwriteSelection - If specified, the selection will be set to this value instead of where it was before.
	 */
	updateDOM(overwriteSelection?: EditorSelection & { direction?: 'forward' | 'backward' | 'none' }, pushUndo = true): void {
		const before = Array.from(this.root.children).map((lineElm) => {
			const elm = lineElm.cloneNode(true) as HTMLElement

			elm.querySelectorAll('.md-hidden')
				.forEach((e) => e.classList.remove('md-hidden'))

			// Some browsers add an empty value to boolean attributes
			return elm.innerHTML.replaceAll('=""', '')
		})
		const after = this.markdown.parse(this.lines)
		const delta = after.length - before.length

		// Changing the DOM confuses the browser about where to place the cursor,
		// so we place it to where it was before the update
		const selection = overwriteSelection ?? this.getSelection()

		if (delta === 0) {
			// No lines added or deleted, apply changes directly
			for (let i = 0; i < after.length; i++) {
				if (before[i] !== after[i])
					this.root.children[i].innerHTML = after[i]
			}
		} else {
			// Calculate the diff range
			const len = Math.max(before.length, after.length)
			let firstChangedLine = 0
			let lastChangedLine = -1

			while (firstChangedLine < len && before[firstChangedLine] === after[firstChangedLine])
				firstChangedLine++

			while (-lastChangedLine < len && before[before.length + lastChangedLine] === after[after.length + lastChangedLine])
				lastChangedLine--

			lastChangedLine = Math.max(len + lastChangedLine, firstChangedLine + Math.abs(delta) - 1)

			// Remove all children in the diff range
			for (let i = lastChangedLine - Math.max(delta, 0); i >= firstChangedLine; i--) {
				if (this.root.children[i])
					this.root.children[i].remove()
			}

			// Add changed lines to a fragment
			const fragment = document.createDocumentFragment()

			for (let i = firstChangedLine; i <= lastChangedLine + Math.min(delta, 0); i++) {
				const line = after[i]

				if (line === undefined)
					continue

				const lineElm = document.createElement('div')

				lineElm.className = 'md-line'
				lineElm.innerHTML = line

				fragment.appendChild(lineElm)
			}

			// Insert the fragment
			this.root.insertBefore(fragment, this.root.children[firstChangedLine] ?? null)
		}

		this.hideMarks(selection)

		// Push the new state to the undo stack
		if (pushUndo) {
			this.undoStack.push({
				lines: [...this.lines],
				selection: {
					start: selection.start,
					end: selection.end,
					direction: selection.direction ?? this.selection.direction
				}
			})

			this.redoStack = []
		}

		if (this.focused)
			this.setSelection(selection)

		this.dispatchEvent('change')
	}

	/**
	 * Hide Markdown syntax of formatting elements
	 * that are not contained within in the currect selection.
	 */
	private hideMarks(selection: EditorSelection): void {
		if (!this.config.hideMarks)
			return this.root.querySelectorAll('.md-hidden').forEach(mark => mark.classList.remove('md-hidden'))

		let blockMarks: Element[] = []
		let blockVisible = false
		let blockType = ''

		// Returns if a node is contained within in the currect selection
		const isVisible = (node: Node) => {
			if (!this.focused)
				return false

			// Native Selection.containsNode doesn't return true if the selection only touches the node
			const nodeOffset = this.getNodeOffset(node)
			const nodeEnd = nodeOffset + (node.textContent?.length ?? 0)

			return selection.start <= nodeEnd && selection.end >= nodeOffset
		}

		for (let lineNum = 0; lineNum < this.lines.length; lineNum++) {
			const lineElm = this.root.children[lineNum]
			const lineType = this.markdown.lineTypes[lineNum]
			const marks = lineElm.querySelectorAll('.md-mark')

			// Toggle the visibility of all marks in a line
			marks.forEach((mark) => {
				mark.classList.toggle('md-hidden', !isVisible(mark.parentNode!))
			})

			// Accumulate all block marks, eg. all blockquote marks in a multiline blockquote
			const inBlock = lineType in this.config.blockHideRules

			// Toggle the visibility of all block marks
			function endBlock() {
				blockMarks.forEach(mark => mark.classList.toggle('md-hidden', !blockVisible))

				blockMarks = []
				blockVisible = false
			}

			// Block type changed
			if (lineType !== blockType)
				endBlock()

			if (inBlock) {
				blockMarks.push(...lineElm.querySelectorAll(this.config.blockHideRules[lineType]))

				if (isVisible(lineElm))
					blockVisible = true
			}

			// End of block
			if (!inBlock || lineElm === this.root.lastChild)
				endBlock()

			blockType = lineType
		}
	}

	undo(): void {
		if (this.undoStack.length < 2)
			return

		const currectState = this.undoStack.pop()!
		const prevState = this.undoStack[this.undoStack.length - 1]

		this.lines = prevState.lines

		this.updateDOM(prevState.selection, false)
		this.redoStack.push(currectState)
	}

	redo(): void {
		const prevState = this.redoStack.pop()

		if (!prevState)
			return

		this.lines = prevState.lines

		this.updateDOM(prevState.selection, false)
		this.undoStack.push(prevState)
	}

	/**
	 * Get a line by number.
	 *
	 * @returns An object with the position and text of the line.
	 */
	line(num: number): Line {
		if (num < 0 || num >= this.lines.length)
			throw new RangeError(`Invalid line ${num} in document with ${this.lines.length} lines`)

		const text = this.lines[num]
		const from = this.lines.slice(0, num).reduce((acc, line) => acc + line.length + 1, 0)

		return { num, from, end: from + text.length, text }
	}

	/**
	 * Get the line around a specific position in the content.
	 *
	 * @returns An object with the position and text of the line.
	 */
	lineAt(pos: number): Line {
		if (pos < 0 || pos > this.content.length)
			throw new RangeError(`Invalid position ${pos} in document of length ${this.content.length}`)

		let num = 0
		let from = 0

		for (const line of this.lines) {
			if (from + line.length >= pos)
				break

			from += line.length + 1
			num++
		}

		const text = this.lines[num]

		return { num, from, end: from + text.length, text }
	}

	/**
	 * Insert the given text at the cursor position,
	 * or replace the currently selected text.
	 */
	insertAtSelection(text: string): void {
		const selection = this.selection
		const content = this.content.slice(0, selection.start)
			+ this.convertIndentation(text)
			+ this.content.slice(selection.end)

		this.lines = content.split('\n')

		this.updateDOM(Editor.selectionFrom(selection.start + text.length))
	}

	/**
	 * Convert the indentation of the lines in a text to spaces or tabs,
	 * depending on how the editor is configured.
	 */
	convertIndentation(text: string): string {
		if (!this.config.convertIndentation)
			return text.replaceAll(/\r\n|\r|\n/, '\n')

		const indentSpaces = ' '.repeat(this.config.tabSize)
		const lines = []

		for (const line of text.split(/\r\n|\r|\n/)) {
			const lineIndent = line.match(/^[\t ]*/)![0]

			if (lineIndent.length) {
				const newIndent = (
					this.config.indentWithSpaces
						? lineIndent.replaceAll('\t', indentSpaces)
						: lineIndent.replaceAll(indentSpaces, '\t')
				)

				lines.push(newIndent + line.substring(lineIndent.length))
			} else
				lines.push(line)
		}

		return lines.join('\n')
	}

	/**
	 * Get the current text selection within the editor.
	 * In most cases you don't need this and `editor.selection` is enough.
	 *
	 * @returns An object with the `start` and `end` position of the selection,
	 * as character offset from the start of the content.
	 */
	getSelection(): EditorSelection & { direction: 'forward' | 'backward' | 'none' } {
		const selection = document.getSelection()

		if (!selection || selection.rangeCount === 0)
			return { start: 0, end: 0, direction: 'none' }

		const range = selection.getRangeAt(0)
		const toStartRange = range.cloneRange()
		const toEndRange = range.cloneRange()

		toStartRange.selectNodeContents(this.root)
		toStartRange.setEnd(range.startContainer, range.startOffset)
		toEndRange.selectNodeContents(this.root)
		toEndRange.setEnd(range.endContainer, range.endOffset)

		function getRangeLength(range: Range): number {
			const fragment = range.cloneContents()
			const lines = fragment.children.length
			const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
			let length = 0
			let node: Node | null

			while (node = walker.nextNode())
				length += (node as Text).length

			return Math.max(0, length + lines - 1)
		}

		function getSelectionDirection() {
			if (!selection)
				return 'none'

			// Currently only Firefox supports direction
			if (selection.direction)
				return selection.direction as 'forward' | 'backward' | 'none'

			if (selection.isCollapsed || selection.anchorNode === null || selection.focusNode === null)
				return 'none'

			if (selection.anchorNode === selection.focusNode)
				return selection.anchorOffset < selection.focusOffset ? 'forward' : 'backward'

			const range = document.createRange()

			range.setStart(selection.anchorNode, selection.anchorOffset)
			range.setEnd(selection.focusNode, selection.focusOffset)

			return range.collapsed ? 'backward' : 'forward'
		}

		const start = Math.max(0, Math.min(getRangeLength(toStartRange), this.content.length))
		const end = Math.max(0, Math.min(getRangeLength(toEndRange), this.content.length))
		const direction = getSelectionDirection()

		return { start, end, direction }
	}

	/**
	 * Set the text selection within the editor.
	 *
	 * @param selection - An object or number specifying the new `start` and `end` position.
	 */
	setSelection(selection: EditorSelection & { direction?: 'forward' | 'backward' | 'none' } | number): void

	/**
	 * Set the text selection within the editor.
	 *
	 * @param selection - An object specifying the new `start` or `end` position.
	 * @param collapse - If true, collapses the selection to the specified `start` or `end` position,
	 * otherwise extends the selection.
	 */
	setSelection(selection: Omit<EditorSelection, 'start'> | Omit<EditorSelection, 'end'>, collapse?: boolean): void

	setSelection(
		selection: number
			| EditorSelection & { direction?: 'forward' | 'backward' | 'none' }
			| Omit<EditorSelection, 'start'>
			| Omit<EditorSelection, 'end'>,
		collapse = true
	): void {
		const documentSelection = document.getSelection()

		if (!documentSelection)
			return

		// Determine the correct new start and end position
		let start = 0
		let end = 0
		let direction: 'forward' | 'backward' | 'none' | null = null

		if (typeof selection === 'number')
			start = end = selection
		else if ('start' in selection && 'end' in selection) {
			start = selection.start
			end = selection.end
			direction = selection.direction ?? null
		} else {
			if (collapse) {
				if ('end' in selection) start = end = selection.end
				else start = end = selection.start
			} else {
				// Extend the current selection
				const currentSelection = this.selection

				if ('start' in selection) {
					start = selection.start
					end = Math.max(currentSelection.end, start)
					direction = 'backward'
				} else {
					end = selection.end
					start = Math.min(currentSelection.start, end)
					direction = 'forward'
				}
			}
		}

		if (direction === null)
			direction = this.state.selection.direction

		// Limit the selection to the bounds of the content
		end = Math.max(0, Math.min(end, this.content.length))
		start = Math.max(0, Math.min(start, end))

		function findNodeAndOffset(targetLength: number, lineElm: Element): [Node, number] {
			const walker = document.createTreeWalker(lineElm, NodeFilter.SHOW_TEXT)
			let length = 0
			let node: Node | null

			while (node = walker.nextNode()) {
				const nodeLength = (node as Text).length

				if (length + nodeLength >= targetLength)
					return [node, targetLength - length]

				length += nodeLength
			}

			return [lineElm, 0]
		}

		let currentLength = 0
		let startOffset = 0
		let endOffset = 0
		let startNode
		let endNode

		for (const lineElm of this.root.children) {
			const isEmptyLine = lineElm.firstChild instanceof HTMLBRElement
			const lineLength = lineElm.textContent?.length ?? 0

			if (!startNode && currentLength + lineLength >= start)
				[startNode, startOffset] = isEmptyLine ? [lineElm, 0] : findNodeAndOffset(start - currentLength, lineElm)

			if (!endNode && currentLength + lineLength >= end) {
				[endNode, endOffset] = isEmptyLine ? [lineElm, 0] : findNodeAndOffset(end - currentLength, lineElm)

				break
			}

			currentLength += lineLength + 1
		}

		if (startNode && endNode) {
			if (direction === 'backward')
				documentSelection.setBaseAndExtent(endNode, endOffset, startNode, startOffset)
			else
				documentSelection.setBaseAndExtent(startNode, startOffset, endNode, endOffset)

			this.updateState({ start, end, direction }, true)
		}
	}

	/**
	* Get the character offset of a node in the editor.
	*/
	getNodeOffset(target: Node): number {
		const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
		let offset = 0
		let node: Node | null

		function isTarget(node: Node): boolean {
			while (node) {
				if (node === target)
					return true

				node = node.parentNode!
			}

			return false
		}

		while (node = walker.nextNode()) {
			// Add one for each direct child of root
			if (node.parentElement === this.root)
				offset++
			else {
				if (isTarget(node))
					break

				if (node.nodeType === Node.TEXT_NODE)
					offset += node.textContent?.length ?? 0
			}
		}

		return offset - 1
	}

	addEventListener(type: string, listener: () => any): void {
		if (!this.listeners[type])
			this.listeners[type] = []

		this.listeners[type].push(listener)
	}

	private dispatchEvent(type: string): void {
		if (!this.listeners[type])
			return

		this.listeners[type].forEach(listener => listener())
	}

	/**
	 * Unregister all event listeners and clean up the editor.
	 */
	destroy(): void {
		this.root.removeEventListener('beforeinput', this.handlers.beforeinput)
		this.root.removeEventListener('input', this.handlers.input)
		this.root.removeEventListener('compositionstart', this.handlers.compositionstart)
		this.root.removeEventListener('compositionend', this.handlers.compositionend)
		this.root.removeEventListener('keydown', this.handlers.key)
		this.root.removeEventListener('paste', this.handlers.paste)
		this.root.removeEventListener('mousedown', this.handlers.mousedown)
		this.root.removeEventListener('click', this.handlers.click)
		this.root.removeEventListener('focus', this.handlers.selection)
		this.root.removeEventListener('blur', this.handlers.selection)
		document.removeEventListener('selectionchange', this.handlers.selection)

		// Make the editor element no longer editable
		this.root.removeAttribute('contenteditable')

		// @ts-expect-error
		this.root.style.webkitUserModify = ''
	}

	/**
	 * Create an `EditorSelection` from a position.
	 */
	static selectionFrom(pos: number): EditorSelection {
		return { start: pos, end: pos }
	}
}
