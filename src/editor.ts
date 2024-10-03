import { MarkdownParser, type MarkdownParserConfig } from './markdown'
import { defaultKeymap, compileKeymap, type Keymap, type CompiledKeybind } from './keymap'
import { defaultBlockHideRules, defaultInlineGrammar, defaultLineGrammar } from './grammar'
import { defu, isFirefox } from './utils'

export interface EditorConfig {
	content: string
	readonly: boolean
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

const defaultConfig: EditorConfig = {
	content: '',
	readonly: false,
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
	private keymap: CompiledKeybind[]
	private handlers = {
		input: this.handleInput.bind(this),
		key: this.handleKey.bind(this),
		paste: this.handlePaste.bind(this),
		mousedown: this.handleMousedown.bind(this),
		click: this.handleClick.bind(this),
		selection: this.handleSelection.bind(this)
	}
	private prevSelection = {
		start: 0,
		end: 0,
		focused: false,
		direction: 'none'
	}
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

		// Important for whitespace formatting and to prevent the browser from replacing spaces with `&nbsp;`
		this.root.style.whiteSpace = 'pre-wrap'
		this.root.style.tabSize = this.config.tabSize.toString()

		if (!this.root.firstChild)
			this.root.innerHTML = '<div class="md-line"><br></div>'

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
		this.root.addEventListener('input', this.handlers.input)
		this.root.addEventListener('compositionend', this.handlers.input)
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

	private handleInput(event: Event): void {
		// For composition input, only update the text after a `compositionend` event
		// Updating the DOM before that will cancel the composition
		if (event instanceof InputEvent && event.isComposing)
			return

		this.updateLines()
		this.updateDOM()
	}

	private handleKey(event: KeyboardEvent): void {
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

	private handleMousedown(event: MouseEvent): void {
		if (this.toggleCheckbox(event, false))
			return

		// Workaround for a bug in Firefox where inline elements prevent line selection on tripleclick
		if (event.detail % 3 !== 0)
			return

		event.preventDefault()

		const selection = document.getSelection()!
		const lineElm = (event.target as Element).closest('.md-line')!
		const range = document.createRange()

		range.selectNodeContents(lineElm)
		selection.removeAllRanges()
		selection.addRange(range)
	}

	private handleClick(event: Event): void {
		this.toggleCheckbox(event)
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
		const pos = checkboxPos - line.from - 2
		const text = line.text

		this.lines[line.num] = text.substring(0, pos)
			+ (text[pos] === ' ' ? 'x' : ' ')
			+ text.substring(pos + 1)

		if (!this.focused)
			this.root.focus()

		this.updateDOM(Editor.selectionFrom(line.end))

		return true
	}

	private handleSelection(): void {
		const selection = this.getSelection()

		if (
			this.prevSelection.start === selection.start
			&& this.prevSelection.end === selection.end
			&& this.prevSelection.focused === this.focused
		)
			return

		this.prevSelection.start = selection.start
		this.prevSelection.end = selection.end
		this.prevSelection.focused = this.focused
		this.prevSelection.direction = this.getSelectionDirection()

		this.hideMarks()
	}

	/**
	 * Read back the content from the DOM
	 */
	private updateLines(): void {
		// Remove elements that aren't editor lines
		for (const lineElm of this.root.children) {
			if (!lineElm.classList.contains('md-line'))
				lineElm.remove()
		}

		if (!this.root.firstChild)
			this.root.innerHTML = '<div class="md-line"><br></div>'

		this.lines = []

		// Using this.root.textContent directly doesn't include line breaks
		for (const lineElm of this.root.children)
			this.lines.push(lineElm.textContent ?? '')
	}

	/**
	 * Apply changes made to the editor content to the DOM.
	 * The Markdown parse function is called here.
	 *
	 * @param overwriteSelection - If specified, the selection will be set to this value instead of where it was before.
	 */
	updateDOM(overwriteSelection?: EditorSelection): void {
		const before = Array.from(this.root.children).map((lineElm) => {
			const elm = lineElm.cloneNode(true) as HTMLElement

			elm.querySelectorAll('.md-hidden')
				.forEach((e) => e.classList.remove('md-hidden'))

			return elm.innerHTML
		})
		const after = this.markdown.parse(this.lines)
		const delta = after.length - before.length

		// Changing the DOM confuses the browser about where to place the cursor,
		// so we place it to where it was before after the update
		const selection = overwriteSelection ?? this.getSelection()

		if (delta === 0) {
			// No lines added or deleted, only apply changes
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
			const fragment = document.createDocumentFragment();

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

		if (this.focused)
			this.setSelection(selection)

		this.hideMarks()
	}

	/**
	 * Hide Markdown syntax of formatting elements
	 * that are not contained within in the currect selection.
	 */
	private hideMarks(): void {
		if (!this.config.hideMarks)
			return this.root.querySelectorAll('.md-hidden').forEach((mark) => mark.classList.remove('md-hidden'))

		const selection = document.getSelection()
		let blockMarks = []
		let blockVisible = false

		// Returns if a node is contained within in the currect selection
		const isVisible = (node: Node) => this.focused && selection?.containsNode(node, true)

		for (let i = 0; i < this.lines.length; i++) {
			const lineElm = this.root.children[i]
			const lineType = this.markdown.lineTypes[i]
			const marks = lineElm.querySelectorAll('.md-mark')

			// Toggle the visibility of all marks in a line
			marks.forEach((mark) => {
				mark.classList.toggle('md-hidden', !isVisible(mark.parentNode!))
			})

			if (lineType in this.config.blockHideRules) {
				// Accumulate all block marks, eg. all blockquote marks in a multiline blockquote
				blockMarks.push(...lineElm.querySelectorAll(this.config.blockHideRules[lineType]))

				if (isVisible(lineElm))
					blockVisible = true
			} else if (blockMarks.length) {
				// Toggle the visibility of all block marks
				blockMarks.forEach((mark) => mark.classList.toggle('md-hidden', !blockVisible))

				blockMarks = []
				blockVisible = false
			}
		}
	}

	/**
	 * Get a line by number.
	 *
	 * @returns An object holding the positions and text of the line.
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
	 * @returns An object holding the positions and text of the line.
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
		const selection = this.getSelection()
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
	 *
	 * @returns An object with the `start` and `end` positions of the selection,
	 * as character offset from the start of the content.
	 */
	getSelection(): EditorSelection {
		const selection = document.getSelection()

		if (!selection || selection.rangeCount === 0)
			return { start: 0, end: 0 }

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
			let node

			while (node = walker.nextNode())
				length += (node as Text).length

			return Math.max(0, length + lines - 1)
		}

		return {
			start: Math.max(0, Math.min(getRangeLength(toStartRange), this.content.length)),
			end: Math.max(0, Math.min(getRangeLength(toEndRange), this.content.length))
		}
	}

	private getSelectionDirection(): 'forward' | 'backward' | 'none' {
		const selection = document.getSelection()

		if (!selection)
			return 'none'

		// Only Firefox directly supports direction
		if ('direction' in selection)
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

	/**
	 * Set the text selection within the editor.
	 *
	 * @param selection - An object specifying the new `start` and `end` positions.
	 */
	setSelection(selection: EditorSelection): void

	/**
	 * Set the text selection within the editor.
	 *
	 * @param selection - An object specifying the new `start` or `end` position.
	 * @param collapse - If true, collapses the selection to the specified `start` or `end` position,
	 * otherwise extends the selection.
	 */
	setSelection(selection: Omit<EditorSelection, 'start'> | Omit<EditorSelection, 'end'>, collapse?: boolean): void

	/**
	 * Set the text selection within the editor.
	 *
	 * @param selection - The new `start` and `end` position of the selection.
	 */
	setSelection(selection: number): void

	setSelection(selection: EditorSelection | Omit<EditorSelection, 'start'> | Omit<EditorSelection, 'end'> | number, collapse = true): void {
		const documentSelection = document.getSelection()

		if (!documentSelection)
			return

		// Determine the correct new start and end positions
		let start = 0
		let end = 0
		let direction = null

		if (typeof selection === 'number')
			start = end = selection
		else if ('start' in selection && 'end' in selection) {
			start = selection.start
			end = selection.end
		} else {
			if (collapse) {
				if ('end' in selection) start = end = selection.end
				else start = end = selection.start
			} else {
				// Extend the current selection
				const currentSelection = this.getSelection()

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
			direction = this.prevSelection.direction

		// Limit the selection to the bounds of the content
		end = Math.max(0, Math.min(end, this.content.length))
		start = Math.max(0, Math.min(start, end))

		function findNodeAndOffset(targetLength: number, lineDiv: Element): [Node, number] {
			const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT)
			let node
			let length = 0

			while (node = walker.nextNode()) {
				const nodeLength = (node as Text).length

				if (length + nodeLength >= targetLength)
					return [node, targetLength - length]

				length += nodeLength
			}

			return [lineDiv, 0]
		}

		let currentLength = 0
		let startOffset = 0
		let endOffset = 0
		let startNode
		let endNode

		for (const lineDiv of this.root.children) {
			const isEmptyLine = lineDiv.firstChild instanceof HTMLBRElement
			const lineLength = lineDiv.textContent?.length ?? 0

			if (!startNode && currentLength + lineLength >= start)
				[startNode, startOffset] = isEmptyLine ? [lineDiv, 0] : findNodeAndOffset(start - currentLength, lineDiv)

			if (!endNode && currentLength + lineLength >= end) {
				[endNode, endOffset] = isEmptyLine ? [lineDiv, 0] : findNodeAndOffset(end - currentLength, lineDiv)

				break
			}

			currentLength += lineLength + 1
		}

		if (startNode && endNode) {
			if (direction === 'backward')
				documentSelection.setBaseAndExtent(endNode, endOffset, startNode, startOffset)
			else
				documentSelection.setBaseAndExtent(startNode, startOffset, endNode, endOffset)
		}
	}

	/**
	* Get the character offset of a node in the editor.
	*/
	getNodeOffset(target: Node): number {
		const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
		let node
		let offset = 0

		function isTarget(node: Node): boolean {
			while (node) {
				if (node === target)
					return true

				node = node.parentNode!
			}

			return false
		}

		while (node = walker.nextNode()) {
			// To not hardcode md-line here, add one for each direct child of the editor instead
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

	/**
	 * Unregister all event listeners and clean up the editor.
	 */
	destroy(): void {
		this.root.removeEventListener('input', this.handlers.input)
		this.root.removeEventListener('compositionend', this.handlers.input)
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
