import { MarkdownParser } from './markdown'

export interface EditorSelection {
	start: number
	end: number
}

export class Editor {
	private lines = ['']
	private markdown = new MarkdownParser()
	readonly root: HTMLElement

	get content(): string {
		return this.lines.join('\n')
	}

	set content(content: string) {
		this.lines = content.split('\n')

		this.updateDOM()

		// Move the cursor to the end
		if (this.focused)
			this.setSelection(content.length)
	}

	get focused(): boolean {
		return this.root === document.activeElement
	}

	/**
	 * Create a new Editor instance.
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
		this.root.addEventListener('input', this.handleInput.bind(this))
		this.root.addEventListener('compositionend', this.handleInput.bind(this))
		this.root.addEventListener('keydown', this.handleKey.bind(this))
		this.root.addEventListener('paste', this.handlePaste.bind(this))
	}

	private handleInput(event: Event): void {
		// For composition input, only update the text after a `compositionend` event
		// Updating the DOM before that will cancel the composition
		if (event instanceof InputEvent && event.isComposing)
			return

		this.updateLines()

		// Changing the DOM confuses the browser about where to place the cursor,
		// so we place it to where it was before after the update
		const selection = this.getSelection()

		this.updateDOM()
		this.setSelection(selection)
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

	private updateLines(): void {
		if (!this.root.firstChild)
			this.root.innerHTML = '<div class="md-line"><br></div>'

		this.lines = []

		// Using this.root.textContent doesn't include line breaks
		for (const node of this.root.children)
			this.lines.push(node.textContent ?? '')
	}

	// TODO: DOM diffing
	private updateDOM(): void {
		this.root.innerHTML = this.markdown.parse(this.lines)

		return

		for (const line of this.lines) {
			const lineElm = document.createElement('div')

			lineElm.className = 'md-line'

			if (line.length === 0)
				lineElm.innerHTML = '<br>'
			else
				lineElm.innerHTML = line

			this.root.appendChild(lineElm)
		}
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
}
