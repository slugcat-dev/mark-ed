import { MarkdownParser } from './markdown'

export interface EditorSelection {
	start: number
	end: number
}

export interface Line {
	num: number
	start: number
	end: number
	text: string
}

export class Editor {
	private markdown = new MarkdownParser()
	private selection = this.getSelection()
	readonly root: HTMLElement

	/**
	 * The lines that the editor content consists of.
	 * If you modify this value, you need to call `editor.updateDOM()` manually.
	 */
	lines: string[] = []

	get content(): string {
		return this.lines.join('\n')
	}

	set content(content: string) {
		this.lines = content.split('\n')

		// Update the DOM and Move the cursor to the end
		this.updateDOM(Editor.selectionFrom(content.length))
	}

	get focused(): boolean {
		return this.root === document.activeElement
	}

	/**
	 * Create a new `Editor` instance.
	 *
	 * @param root - The element on which the editor will be rendered.
	 */
	constructor(root: HTMLElement | string) {
		const element = typeof root === 'string'
			? document.getElementById(root)
			: root

		if (!element)
			throw Error('Could not create editor: Element does not exist')

		this.root = element

		this.createEditorElement()
	}

	private createEditorElement(): void {
		this.root.classList.add('md-editor')
		this.root.setAttribute('contenteditable', 'true')

		// Important for whitespace formatting and to prevent the browser from replacing spaces with `&nbsp;`
		this.root.style.whiteSpace = 'pre-wrap'

		// Prevent the rich formatting popup on iOS
		// @ts-expect-error
		this.root.style.webkitUserModify = 'read-write-plaintext-only'

		// TODO: EditorConfig
		this.root.style.tabSize = '2'
		this.root.innerHTML = '<div class="md-line"><br></div>'

		// Add event listeners
		this.root.addEventListener('input', this.handleInputBound)
		this.root.addEventListener('compositionend', this.handleInputBound)
		this.root.addEventListener('keydown', this.handleKeyBound)
		this.root.addEventListener('paste', this.handlePasteBound)
		document.addEventListener('selectionchange', this.handleSelectionBound)
	}

	private handleInputBound = this.handleInput.bind(this)
	private handleKeyBound = this.handleKey.bind(this)
	private handlePasteBound = this.handlePaste.bind(this)
	private handleSelectionBound = this.handleSelection.bind(this)

	private handleInput(event?: Event): void {
		// For composition input, only update the text after a `compositionend` event
		// Updating the DOM before that will cancel the composition
		if (event instanceof InputEvent && event.isComposing)
			return

		this.updateLines()
		this.updateDOM()
	}

	private handleKey(event: KeyboardEvent): void {
		// TODO: Keymap handler

		if (event.key === 'Enter') {
			event.preventDefault()
			this.insertAtSelection('\n')
		} else if (event.key === 'Tab') {
			event.preventDefault()
			this.insertAtSelection('\t')
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
		for (const node of this.root.children)
			this.lines.push(node.textContent ?? '')
	}

	// TODO: DOM diffing
	/**
	 * Apply changes made to the editor content to the DOM.
	 * Also calls the Markdown parse function.
	 *
	 * @param overwriteSelection - If specified, the selection will be set to this value instead of where it was before.
	 */
	updateDOM(overwriteSelection?: EditorSelection): void {
		// Changing the DOM confuses the browser about where to place the cursor,
		// so we place it to where it was before after the update
		const selection = overwriteSelection ?? this.getSelection()

		this.root.innerHTML = ''

		for (const line of this.markdown.parse(this.lines)) {
			const lineElm = document.createElement('div')

			lineElm.className = 'md-line'
			lineElm.innerHTML = line

			this.root.appendChild(lineElm)
			this.hideMarks(lineElm, selection)
		}

		if (this.focused)
			this.setSelection(selection)
	}

	/**
	 * Hide Markdown marks in a line that are not in the currect selection.
	 */
	private hideMarks(lineElm: Element, selection: EditorSelection): void {
		lineElm.querySelectorAll(':has(> .md-mark)').forEach(element => {
			const start = this.getElmOffset(element)
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
	private getElmOffset(target: Element): number {
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
		const start = this.lines.slice(0, num).reduce((acc, line) => acc + line.length + 1, 0)
		const end = start + text.length

		return { num, start, end, text }
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
		let start = 0

		for (const line of this.lines) {
			if (start + line.length >= pos)
				break

			start += line.length + 1
			num++
		}

		const text = this.lines[num]
		const end = start + text.length

		return { num, start, end, text }
	}

	/**
	 * Insert the given text at the cursor position,
	 * or replace the currently selected text.
	 */
	insertAtSelection(text: string): void {
		const selection = this.getSelection()

		this.content = this.content.slice(0, selection.start) + text + this.content.slice(selection.end)
		selection.start = selection.end = selection.start + text.length

		this.setSelection(selection)
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
		this.root.removeEventListener('input', this.handleInputBound)
		this.root.removeEventListener('compositionend', this.handleInputBound)
		this.root.removeEventListener('keydown', this.handleKeyBound)
		this.root.removeEventListener('paste', this.handlePasteBound)
		document.removeEventListener('selectionchange', this.handleSelectionBound)

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
