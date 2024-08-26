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
		this.root.addEventListener('input', this.handleInputEvent.bind(this))
		this.root.addEventListener('compositionend', this.handleInputEvent.bind(this))
	}

	private handleInputEvent(event: InputEvent | CompositionEvent): void {
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

	private updateLines(newParagraph: boolean = false): void {
		let { start, end } = this.getSelection()
		let currentElm = null

		if (newParagraph) {
			const selection = window.getSelection()

			if (selection && selection.rangeCount > 0) {
				const range = selection.getRangeAt(0)
				const currentElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
					? range.commonAncestorContainer.parentElement
					: range.commonAncestorContainer as HTMLElement

				if (currentElement)
					currentElm = currentElement
			}
		}

		this.lines = []

		for (const node of this.root.childNodes) {
			if (node !== currentElm)
				this.lines.push(...(node.textContent ?? '').split('\n'))
			else {
				const parts = (currentElm.textContent ?? '').split('\n')

				this.lines.push(parts[0])
				this.lines.push(parts[1])
			}
		}

		this.root.innerHTML = ''

		this.updateDOM()
		this.setSelection(start, end)
	}

	private updateDOM(): void {
		for (const line of this.lines) {
			const lineElm = document.createElement('div')

			lineElm.className = 'md-line'
			lineElm.textContent = line

			if (line.length === 0)
				lineElm.innerHTML = '<br>'

			this.root.appendChild(lineElm)
		}
	}

	private getSelection(): { start: number, end: number } {
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

			console.log('len', length)
			console.log(fragment)

			// TODO: what if no len? -1 when mpt
			return length + fragment.querySelectorAll('div').length - 1
		}

		return {
			start: getRangeLength(toStartRange),
			end: getRangeLength(toEndRange)
		}
	}

	private setSelection(start: number, end: number): void {
		console.log(start)
		const selection = document.getSelection()

		if (!selection)
			return

		const range = document.createRange()
		let currentLength = 0
		let startNode: Node | null = null
		let startOffset = 0
		let endNode: Node | null = null
		let endOffset = 0

		for (const lineDiv of this.root.children) {
			if (!(lineDiv instanceof HTMLDivElement)) continue

			const lineLength = lineDiv.textContent?.length ?? 0
			const isEmptyLine = lineDiv.firstChild instanceof HTMLBRElement

			if (!startNode && currentLength + lineLength >= start) {
				startNode = isEmptyLine ? lineDiv : lineDiv.firstChild
				startOffset = isEmptyLine ? 0 : start - currentLength
			}

			if (!endNode && currentLength + lineLength >= end) {
				endNode = isEmptyLine ? lineDiv : lineDiv.firstChild
				endOffset = isEmptyLine ? 0 : end - currentLength
				break
			}

			currentLength += lineLength + 1
		}

		if (startNode && endNode) {
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
		this.lines = content.split('\n')

		this.updateDOM()
	}
}
