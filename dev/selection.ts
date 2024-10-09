import { Editor } from '../src'

const editor = new Editor('editor', {
	content: '# Hello, World!\nThis is `mark-ed`, an in-browser editor that supports Markdown formatting.\n\n[**View on GitHub**](https://github.com/slugcat-dev/mark-ed)',
	hideMarks: true
})

// Custom caret and selection
const selectionLayer = editor.root.parentElement!.querySelector('.selection-layer') as HTMLElement

editor.addEventListener('selectionchange', () => {
	// Remove old selection rects
	selectionLayer.querySelectorAll('.selection-rect').forEach(elm => elm.remove())

	if (editor.focused)
		renderSelectionRange(editor.selection.start, editor.selection.end)

	renderSelectionRange(25, 32, 'test')
})

// Render the selection in the given character range
function renderSelectionRange(start: number, end: number, id = 'client'): void {
	const startLine = editor.lineAt(start)
	const endLine = editor.lineAt(end)
	const editorRect = editor.root.getBoundingClientRect()
	const collapsed = start === end

	for (let lineNum = startLine.num; lineNum <= endLine.num; lineNum++) {
		const lineElm = editor.root.children[lineNum]
		const lineRect = lineElm.getBoundingClientRect()
		let left = lineRect.left - editorRect.left
		let top = lineRect.top - editorRect.top
		let height = lineRect.height
		let rect: DOMRect

		if (lineNum === startLine.num) {
			if (startLine.num === endLine.num)
				rect = getRect(start - startLine.from, end - endLine.from, lineElm)
			else
				rect = getRect(start - startLine.from, startLine.text.length, lineElm)

			left = Math.max(lineRect.left, rect.left) - editorRect.left
		} else if (lineNum === endLine.num)
			rect = getRect(0, end - endLine.from, lineElm)
		else {
			const range = document.createRange()

			range.selectNodeContents(lineElm)

			rect = range.getBoundingClientRect()
		}

		const elm = document.createElement('div')

		elm.classList.add('selection-rect')
		elm.classList.add(`selection-${id}`)

		if (collapsed) {
			const fontSize = parseFloat(getComputedStyle(lineElm).fontSize)
			const caretHeight = lineRect.height - fontSize * 1.125

			top = top + caretHeight / 2
			height = height - caretHeight

			elm.classList.add('collapsed')
		}

		elm.style.top = `${top}px`
		elm.style.left = `${left}px`
		elm.style.width = `${rect.width}px`
		elm.style.height = `${height}px`

		// Color different selections differently
		if (id !== 'client') {
			const hue = strToHue(id)

			// Add a label to the first line of the selection
			if (lineNum === startLine.num) {
				const label = document.createElement('div')

				label.className = 'selection-label'
				label.innerHTML = id.toUpperCase()
				label.style.backgroundColor = `hsl(${hue}, 50%, 25%)`

				elm.appendChild(label)
			}

			elm.style.backgroundColor = `hsla(${hue}, 50%, 50%, .5)`
		}

		selectionLayer.appendChild(elm)
	}
}

// Get the client rect of a character range in a line
function getRect(start: number, end: number, lineElm: Element): DOMRect {
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

	const isEmptyLine = lineElm.firstChild instanceof HTMLBRElement
	const [startNode, startOffset] = isEmptyLine ? [lineElm, 0] : findNodeAndOffset(start, lineElm)
	const [endNode, endOffset] = isEmptyLine ? [lineElm, 0] : findNodeAndOffset(end, lineElm)
	const range = document.createRange()

	range.setStart(startNode, startOffset)
	range.setEnd(endNode, endOffset)

	return range.getBoundingClientRect()
}

function strToHue(str: string): number {
	let hash = 0

	for (let i = 0; i < str.length; i++)
		hash = str.charCodeAt(i) + ((hash << 8) - hash)

	return hash % 360
}
