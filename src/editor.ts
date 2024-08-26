export interface EditorSelection {
	start: number
	end: number
}

export class Editor {
	private root: HTMLElement
	private lines: string[] = []

	constructor(root: HTMLElement | string, content?: string) {
		const element = typeof root === 'string'
			? document.getElementById(root)
			: root

		if (!element)
			throw Error('Could not create editor: Root element does not exist')

		this.root = element

		this.createEditorElement()
		this.updateLines()

		if (content)
			this.content = content
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
		// @ts-expect-error This seems to be an error in TypeScript, see
		// https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event#event_type
		this.root.addEventListener('input', this.handleInput.bind(this))
		this.root.addEventListener('compositionend', this.handleInput.bind(this))
		this.root.addEventListener('keydown', this.handleKey.bind(this))
		this.root.addEventListener('paste', this.handlePaste.bind(this))
	}

	private handleInput(event: InputEvent | CompositionEvent): void {
		// For composition input, only update the text after a `compositionend` event
		// Updating the DOM before that will cancel the composition
		if (event instanceof InputEvent) {
			if (event.inputType === 'insertCompositionText')
				return

			if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak')
				this.updateLines(true)
			else {
				 if (!this.root.firstChild)
					this.root.innerHTML = '<div class="md-line"><br></div>'

				 this.updateLines()
			}
		} else
			this.updateLines()
	}

	private handleKey(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault()
			this.insert('\n')
		} else if (event.key === 'Tab') {
			event.preventDefault()
			this.insert('\t')
		}
	}

	private handlePaste(event: ClipboardEvent): void {
		event.preventDefault()

		if (!event.clipboardData)
			return

    this.insert(event.clipboardData.getData('text/plain'))
	}

	private updateLines(newParagraph: boolean = false): void {
		let selection = this.getSelection()
		let currentElm = null

		if (newParagraph) {
			const selection = window.getSelection()

			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0)

				currentElm = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
					? range.commonAncestorContainer.parentElement
					: range.commonAncestorContainer as HTMLElement
			}
		}

		this.lines = []

		for (const node of this.root.childNodes) {
			const parts = (node.textContent ?? '').split('\n')

			/*if (node === currentElm && parts.length >= 3 &&parts.slice(-2).every(p => p === ''))
				parts.pop()*/

			this.lines.push(...parts)
		}

		this.updateDOM()
		this.setSelection(selection)
	}

	private updateDOM(): void {
		this.root.innerHTML = ''

		for (const line of this.lines) {
			const lineElm = document.createElement('div')

			lineElm.className = 'md-line'
			lineElm.innerHTML = markdown(line)

			if (line.length === 0)
				lineElm.innerHTML = '<br>'

			this.root.appendChild(lineElm)
		}
	}

	insert(text: string): void {
		const selection = this.getSelection()

		this.content = this.content.slice(0, selection.start) + text + this.content.slice(selection.end)
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

		const getRangeLength = (range: Range) => {
			const fragment = range.cloneContents()
			const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT)
			let length = 0
			let node

			while (node = walker.nextNode())
				length += (node as Text).length

			return Math.max(0, length + fragment.querySelectorAll('div.md-line').length - 1)
		}

		return {
			start: getRangeLength(toStartRange),
			end: getRangeLength(toEndRange)
		}
	}

	setSelection({ start, end }: EditorSelection): void {
		const selection = document.getSelection()

		if (!selection)
			return

		let currentLength = 0
		let startNode: Node | null = null
		let startOffset = 0
		let endNode: Node | null = null
		let endOffset = 0

		const findNodeAndOffset = (targetLength: number, lineDiv: Element): [Node, number] => {
			let currentLength = 0
			const walker = document.createTreeWalker(lineDiv, NodeFilter.SHOW_TEXT)

			let node: Node | null
			while (node = walker.nextNode()) {
				const nodeLength = (node as Text).length
				if (currentLength + nodeLength >= targetLength) {
					return [node, targetLength - currentLength]
				}
				currentLength += nodeLength
			}

			return [lineDiv, 0]
		}

		for (const lineDiv of this.root.children) {
			if (!lineDiv.matches('div.md-line'))
				continue

			const isEmptyLine = lineDiv.firstChild instanceof HTMLBRElement
			const lineLength = lineDiv.textContent?.length ?? 0

			if (!startNode && currentLength + lineLength >= start) {
				[startNode, startOffset] = isEmptyLine ? [lineDiv, 0] : findNodeAndOffset(start - currentLength, lineDiv)
			}

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

	get content(): string {
		return this.lines.join('\n')
	}

	// TODO
	set content(content: string) {
		const selection = this.getSelection()

		this.lines = content.split('\n')
		selection.start = selection.end = selection.start + content.length

		this.updateDOM()

		if (this.root.matches(':focus'))
			this.setSelection(selection)
	}
}

function escapeHTMLEncode(str: string) {
  var div = document.createElement('div');
  var text = document.createTextNode(str);
  div.appendChild(text);
  return div.innerHTML;
 }

function markdown(text: string) {
	text = escapeHTMLEncode(text)

	const tokens = []

	// Headings
	tokens.push([...text.matchAll(/^(?<formatting>#)(?<text>\s.*$)/gim)])

	// Highlight
	tokens.push([...text.matchAll(/^(?<formatting>!!)(?<text>\s.*$)/gim)])

	// Bold, Italic
	tokens.push([...text.matchAll(/(?<formatting>\*{1,3})(?<text>[^\*]*?[^\*])\1/gim)])
	tokens.push([...text.matchAll(/(?<formatting>_{1,3})(?<text>[^_]*?[^_])\1/gim)])

	// Inline code
	tokens.push([...text.matchAll(/(?<formatting>`)(?<text>[^`]*?[^`])\1/gim)])

	for (const token of tokens.flatMap(t => t)) {
		const symbol = `<span class="md-mark">${token.groups.formatting}</span>`
		const md = (() => {
			switch (token.groups.formatting) {
				// Headings
				case '#': return `<h1>${symbol}${token.groups.text}</h1>`

				// Highlight
				case '!!': return `<b style="color: #f80">${symbol}${token.groups.text}</b>`

				// Italic
				case '*':
				case '_': return `<i>${symbol}${token.groups.text}${symbol}</i>`

				// Bold
				case '**':
				case '__': return `<b>${symbol}${token.groups.text}${symbol}</b>`

				// Bold + Italic
				case '***':
				case '___': return `<b><i>${symbol}${token.groups.text}${symbol}</i></b>`

				// Inline code
				case '`': return `<code>${symbol}${token.groups.text}${symbol}</code>`
				default: return token[0]
			}
		})()

		text = text.replace(token[0], md)
	}

	return text
}
