import { MarkdownParser } from './markdown'
import { defaultKeymap, type Keymap, type CompiledKeybind, compileKeymap } from './keymap'
import { defu } from './utils'

export interface EditorConfig {
	content: string
	tabSize: number
	hideMarks: boolean
	keymap: Keymap
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
	tabSize: 2,
	hideMarks: true,
	keymap: defaultKeymap
}

export class Editor {
	private selection = this.getSelection()
	private markdown = new MarkdownParser()
	private config: EditorConfig
	private keymap: CompiledKeybind[]
	readonly root: HTMLElement

	/**
	 * The lines that the editor content consists of.
	 * If you modify this value, you need to call `editor.updateDOM()` manually.
	 */
	lines: string[] = []

	get lineTypes(): (string | null)[] {
		return this.markdown.lineTypes
	}

	get content(): string {
		return this.lines.join('\n')
	}

	set content(content: string) {
		this.lines = content.split(/\r\n|\r|\n/)

		// Update the DOM and move the cursor to the end
		this.updateDOM(Editor.selectionFrom(content.length))
	}

	get focused(): boolean {
		return this.root === document.activeElement
	}

	/**
	 * Create a new `Editor` instance.
	 *
	 * @param root - The element on which the editor will be rendered.
	 * @param config - The configuration for the editor.
	 */
	constructor(root: HTMLElement | string, config: Partial<EditorConfig>) {
		const element = typeof root === 'string'
			? document.getElementById(root)
			: root

		if (!element)
			throw Error('Could not create editor: Element does not exist')

		this.root = element

		this.createEditorElement()

		this.config = defu(config, defaultConfig)
		this.content = this.config.content
		this.root.style.tabSize = this.config.tabSize.toString()
		this.keymap = compileKeymap(this.config.keymap)
	}

	private createEditorElement(): void {
		this.root.classList.add('md-editor')
		this.root.setAttribute('contenteditable', 'true')

		// Important for whitespace formatting and to prevent the browser from replacing spaces with `&nbsp;`
		this.root.style.whiteSpace = 'pre-wrap'

		// Prevent the rich formatting popup on iOS
		// @ts-expect-error
		this.root.style.webkitUserModify = 'read-write-plaintext-only'

		// Add event listeners
		this.root.addEventListener('input', (event) => this.handleInput(event))
		this.root.addEventListener('compositionend', (event) => this.handleInput(event))
		this.root.addEventListener('keydown', (event) => this.handleKey(event))
		this.root.addEventListener('paste', (event) => this.handlePaste(event))
		this.root.addEventListener('focus', () => this.handleSelection())
		this.root.addEventListener('blur', () => this.handleSelection())
		document.addEventListener('selectionchange', () => this.handleSelection())
	}

	private handleInput(event?: Event): void {
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

		this.insertAtSelection(event.clipboardData.getData('text/plain'))
	}

  private handleSelection(): void {
		const selection = this.getSelection()

		if (selection.start === this.selection.start && selection.end === this.selection.end)
			return

		this.selection = selection

		for (const lineElm of this.root.children)
			this.hideMarks(lineElm, selection)
	}

	/**
	 * Read back the content from the DOM
	 */
	private updateLines(): void {
		if (!this.root.firstChild)
			this.root.innerHTML = '<div class="md-line"><br></div>'

		this.lines = []

		// Using this.root.textContent doesn't include line breaks
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
		const before = this.markdown.lines
		const after = this.markdown.parse(this.lines)
		const delta = after.length - before.length
		const len = Math.max(before.length, after.length)

		// Changing the DOM confuses the browser about where to place the cursor,
		// so we place it to where it was before after the update
		const selection = overwriteSelection ?? this.getSelection()

		if (delta === 0) {
			// No lines added or deleted, only apply changes
			for (let i = 0; i < len; i++) {
				if (before[i] !== after[i])
					this.root.children[i].innerHTML = after[i]
			}
		} else {
			// Calculate the diff range
			let start = 0
			let end = len - 1

			while (start < len && before[start] === after[start])
				start++

			while (end - 1 > start && before[end - Math.max(delta, 0)] === after[end - Math.min(delta, 0)])
				end--

			console.log(start, end)

			// Remove all children in the diff range
			for (let i = start; i <= end - Math.max(delta, 0); i++) {
				if (this.root.children[start])
					this.root.removeChild(this.root.children[start])
			}

			// Insert the new or updated lines
			for (let i = start; i <= end; i++) {
				const line = after[i]

				if (line === undefined)
					continue

				const lineElm = document.createElement('div')

				lineElm.className = 'md-line'
				lineElm.innerHTML = line

				this.root.insertBefore(lineElm, this.root.children[i] ?? null)
			}
		}

		for (const lineElm of this.root.children)
			this.hideMarks(lineElm, selection)

		if (this.focused)
			this.setSelection(selection)
	}

	/**
	 * Hide Markdown marks in a line that are not in the currect selection.
	 */
	private hideMarks(lineElm: Element, selection: EditorSelection): void {
		if (!this.config.hideMarks)
			return

		lineElm.querySelectorAll(':has(> .md-mark)').forEach(element => {
			const start = this.getElementOffset(element)
			const end = start + (element.textContent?.length ?? 0)
			const marks = element.querySelectorAll('& > .md-mark')
			const isVisible = selection.start <= end && selection.end >= start

			marks.forEach(mark => {
				(mark as HTMLElement).classList.toggle('md-hidden', !(this.focused && isVisible))
			})
		})
	}

	/**
	* Get the character offset of an element.
	*/
	private getElementOffset(target: Element): number {
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
			else if (node.nodeType === Node.TEXT_NODE) {
				if (isTarget(node))
						break

				offset += node.textContent?.length ?? 0
			}
		}

		return offset - 1
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
		const content = this.content.slice(0, selection.start) + text + this.content.slice(selection.end)

		this.lines = content.split(/\r\n|\r|\n/)
		selection.start = selection.end = selection.start + text.length

		this.updateDOM(selection)
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

		// Again, range.textContent would not include line breaks
		function getRangeLength(range: Range): number {
			const fragment = range.cloneContents()
			const lines = fragment.querySelectorAll('div.md-line').length
			const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
			let node
			let length = 0

			while (node = walker.nextNode())
				length += (node as Text).length

			return Math.max(0, length + lines - 1)
		}

		return {
			start: Math.max(0, Math.min(getRangeLength(toStartRange), this.content.length)),
			end: Math.max(0, Math.min(getRangeLength(toEndRange), this.content.length))
		}
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
	 * @param selection - An object specifying the new `start` and `end` positions.
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
				} else {
					end = selection.end
					start = Math.min(currentSelection.start, end)
				}
			}
		}

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
			const range = document.createRange()

			range.setStart(startNode, startOffset)
			range.setEnd(endNode, endOffset)
			documentSelection.removeAllRanges()
			documentSelection.addRange(range)
		}
	}

	/**
	 * Unregister all event listeners and clean up the editor.
	 */
	destroy(): void {
		this.root.removeEventListener('input', (event) => this.handleInput(event))
		this.root.removeEventListener('compositionend', (event) => this.handleInput(event))
		this.root.removeEventListener('keydown', (event) => this.handleKey(event))
		this.root.removeEventListener('paste', (event) => this.handlePaste(event))
		this.root.removeEventListener('focus', () => this.handleSelection())
		this.root.removeEventListener('blur', () => this.handleSelection())
		document.removeEventListener('selectionchange', () => this.handleSelection())

		// Make the editor no longer editable
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
