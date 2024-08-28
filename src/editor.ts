import { EditorState } from './state'
import type { EditorSelection } from './types'

export class Editor {
	readonly root: HTMLElement
	readonly state = new EditorState()

	constructor(root: HTMLElement | string | null, content?: string) {
		const element = typeof root === 'string'
			? document.getElementById(root)
			: root

		if (!element)
			throw Error('Could not create editor: Root element does not exist')

		this.root = element

		this.createEditorElement()

		if (content)
			this.state.content = content
	}

	private createEditorElement(): void {
		this.root.classList.add('md-editor')
		this.root.setAttribute('contenteditable', 'true')

		// Important for whitespace formatting and to prevent the browser from replacing spaces with `&nbsp;`
		this.root.style.whiteSpace = 'pre-wrap'

		// Prevent the rich formatting popup on iOS
		// @ts-expect-error
		this.root.style.webkitUserModify = 'read-write-plaintext-only'

		// Clear the DOM
		this.root.innerHTML = '<div class="md-line"><br></div>'

		// Add event listeners
		this.root.addEventListener('input', this.handleInput.bind(this))
		this.root.addEventListener('compositionend', this.handleInput.bind(this))
		this.root.addEventListener('keydown', this.handleKey.bind(this))
		this.root.addEventListener('paste', this.handlePaste.bind(this))
		this.state.addEventListener('contentchange', this.handleContentUpdate.bind(this))
		document.addEventListener('selectionchange', this.handleSelectionChange.bind(this))
	}

	get focused(): boolean {
		return this.root === document.activeElement
	}

	private handleSelectionChange(e: Event) {
		this.state.selection = this.getSelection()

		console.log(this.state.selection)
	}

	private handleContentUpdate() {
		this.updateDOM()
		// TODO: cursor at end
	}

	private handleInput(event: Event): void {
		// For composition input, only update the text after a `compositionend` event
		// Updating the DOM before that will cancel the composition
		if (event instanceof InputEvent && event.isComposing)
			return

		this.updateLines()
	}

	// TODO: keymap handler
	private handleKey(event: KeyboardEvent): void {
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

	// TODO: rn, state
	private updateLines(): void {
		this.state.clearLines()
		let lines: string[] = []

		if (!this.root.firstChild) {
			this.root.innerHTML = '<div class="md-line"><br></div>'

			return
		}

		for (const node of this.root.childNodes)
			lines.push(...(node.textContent ?? '').split('\n'))

		this.state.content = lines.join('\n')
	}

	private updateDOM(): void {
		const selection = this.getSelection()

		this.root.innerHTML = ''

		// TODO: state, smart upd
		for (const line of this.state.lines) {
			const lineElm = document.createElement('div')

			lineElm.className = 'md-line'
			lineElm.innerHTML = markdown(line)

			if (line.length === 0)
				lineElm.innerHTML = '<br>'

			this.root.appendChild(lineElm)
		}

		this.setSelection(selection)
	}

	// TODO: rev, state
	insertAtSelection(text: string): void {
		const selection = this.getSelection()

		this.state.content = this.state.content.slice(0, selection.start) + text + this.state.content.slice(selection.end)
		selection.start = selection.end = selection.start + text.length

		this.setSelection(selection)
	}

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
			const lines = fragment.querySelectorAll('div.md-line').length
			const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
			let node
			let length = 0

			while (node = walker.nextNode())
				length += (node as Text).length

			return Math.max(0, length + lines - 1)
		}

		return {
			start: Math.min(Math.max(getRangeLength(toStartRange), 0), this.state.content.length),
			end: Math.min(Math.max(getRangeLength(toEndRange), 0), this.state.content.length)
		}

		// TODO: out of bounds check
	}

	setSelection({ start, end }: EditorSelection): void {
		const selection = document.getSelection()

		if (!selection)
			return

		end = Math.max(0, Math.min(end, this.state.content.length))
		start = Math.max(0, Math.min(start, end))

		let currentLength = 0
		let startNode: Node | null = null
		let startOffset = 0
		let endNode: Node | null = null
		let endOffset = 0

		function findNodeAndOffset(targetLength: number, lineDiv: Element): [Node, number] {
			const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT)
			let length = 0
			let node

			while (node = walker.nextNode()) {
				const nodeLength = (node as Text).length

				if (length + nodeLength >= targetLength)
					return [node, targetLength - length]

				length += nodeLength
			}

			return [lineDiv, 0]
		}

		for (const lineDiv of this.root.children) {
			if (!lineDiv.matches('div.md-line'))
				continue

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
			selection.removeAllRanges()
			selection.addRange(range)
		}
	}
}

// TODO
function markdown(text: string) {
	function escapeHTML(str: string) {
		const elm = document.createElement('div')
		const text = document.createTextNode(str)

		elm.appendChild(text)

		return elm.innerHTML
	}

	text = escapeHTML(text)

	const tokens = []

	// Headings
	tokens.push([...text.matchAll(/^(?<formatting>#{1,6})(?<text>\s.*$)/gim)])

	// Highlight
	tokens.push([...text.matchAll(/^(?<formatting>!!)(?<text>\s.*$)/gim)])

	// Bold, Italic
	tokens.push([...text.matchAll(/(?<formatting>\*{1,3})(?<text>[^\*]*?[^\*])\1/gim)])
	tokens.push([...text.matchAll(/(?<formatting>_{1,3})(?<text>[^_]*?[^_])\1/gim)])

	// Inline code
	tokens.push([...text.matchAll(/(?<formatting>`)(?<text>[^`]*?[^`])\1/gim)])

	for (const token of tokens.flatMap(t => t)) {
		const symbol = `<span class="md-mark">${token.groups!.formatting}</span>`
		const md = (() => {
			switch (token.groups!.formatting) {
				// Headings
				case '#':
				case '##':
				case '###':
				case '####':
				case '#####':
				case '######': return `<h${token.groups!.formatting.length}>${symbol}${token.groups!.text}<h${token.groups!.formatting.length}>`

				// Highlight
				case '!!': return `<b style="color: #f80">${symbol}${token.groups!.text}</b>`

				// Italic
				case '*':
				case '_': return `<i>${symbol}${token.groups!.text}${symbol}</i>`

				// Bold
				case '**':
				case '__': return `<b>${symbol}${token.groups!.text}${symbol}</b>`

				// Bold + Italic
				case '***':
				case '___': return `<b><i>${symbol}${token.groups!.text}${symbol}</i></b>`

				// Inline code
				case '`': return `<code>${symbol}${token.groups!.text}${symbol}</code>`
				default: return token[0]
			}
		})()

		text = text.replace(token[0], md)
	}

	return text
}

// TODO:
// - editor state
//	- selection
//	- doc
//	- lineAt
// - smart dom upd
