import { Editor } from '../src/index'

const editor = new Editor('editor', {
	content: '# Hello, World!\nThis is `mark-ed`, an in-browser editor that supports Markdown formatting.\n\n[**View on GitHub**](https://github.com/slugcat-dev/mark-ed)',
	hideMarks: true
})

// Custom caret and selection
const caret = document.getElementById('caret')!
const selectionLayer = document.getElementById('selectionLayer')!

document.addEventListener('selectionchange', () => {
	renderCaret()
	renderSelection()
})

function renderCaret() {
	const selection = document.getSelection()

	// Calculate the caret position
	if (selection && selection.focusNode) {
		const range = document.createRange()
		const focusNode = selection.focusNode

		range.setStart(editor.root, 0)
		range.setEnd(focusNode, selection.focusOffset)
		range.collapse()

		const rangeRect = range.getBoundingClientRect()
		const caretRect = DOMRect.fromRect(rangeRect)
		const editorRect = editor.root.getBoundingClientRect()

		// Fix for empty lines
		if (focusNode instanceof HTMLDivElement && focusNode.firstChild instanceof HTMLBRElement) {
			const lineRect = focusNode.getBoundingClientRect()
			const computedStyle = getComputedStyle(focusNode)
			const fontSize = parseFloat(computedStyle.fontSize)
			const caretHeight = lineRect.height - fontSize * 1.125

			caretRect.x = lineRect.x
			caretRect.y = lineRect.y + caretHeight / 2
			caretRect.height = lineRect.height - caretHeight
		}

		caret.style.top = `${caretRect.top - editorRect.top}px`
		caret.style.left = `${caretRect.left - editorRect.left}px`
		caret.style.height = `${caretRect.height}px`
	}

	// Hide the caret if the editor is not focused
	caret.classList.toggle('visible', editor.focused)

	// Restart the caret blink animation
	if (caret.style.animationName === 'blink-1')
		caret.style.animationName = 'blink-2'
	else
		caret.style.animationName = 'blink-1'
}

function renderSelection() {
	// Remove old selection rects
	selectionLayer.querySelectorAll('.selection-rect').forEach((elm) => elm.remove())

	const selection = editor.getSelection()

	if (selection.collapsed)
		return

	renderSelectionRange(selection.start, selection.end)
}

// Render the selection in the given character range
function renderSelectionRange(start: number, end: number, id = 'client') {
	const startLine = editor.lineAt(start)
	const endLine = editor.lineAt(end)
	const editorRect = editor.root.getBoundingClientRect()

	for (let lineNum = startLine.num; lineNum <= endLine.num; lineNum++) {
		const lineElm = editor.root.children[lineNum]
		const lineRect = lineElm.getBoundingClientRect()
		const computedStyle = getComputedStyle(lineElm)
		let left = lineRect.left - editorRect.left
		let rect
		let width

		if (lineNum === startLine.num) {
			if (startLine.num === endLine.num)
				rect = getRect(start - startLine.from, end - endLine.from, lineElm)
			else
				rect = getRect(start - startLine.from, startLine.text.length, lineElm)

			left = rect.left - editorRect.left
		} else if (lineNum !== endLine.num) {
			const range = document.createRange()

			range.selectNodeContents(lineElm)

			rect = range.getBoundingClientRect()
		} else
			rect = getRect(0, end - endLine.from, lineElm)

		width = rect.width

		const elm = document.createElement('div')

		elm.classList.add('selection-rect')
		elm.classList.add(`selection-${id}`)

		elm.style.top = `${lineRect.top - editorRect.top}px`
		elm.style.left = `${left}px`
		elm.style.width = `${width}px`
		elm.style.height = `${parseFloat(computedStyle.height)}px`

		// Color different selections differently
		if (id !== 'client') {
			const hue = strToHue(id)

			elm.style.backgroundColor = `hsla(${hue}, 50%, 50%, .5)`

			// Add a label to the first line of the selection
			if (lineNum === startLine.num) {
				const label = document.createElement('div')

				label.className = 'label'
				label.innerHTML = id.toUpperCase()
				label.style.backgroundColor = `hsl(${hue}, 50%, 25%)`

				elm.appendChild(label)
			}
		}

		selectionLayer.appendChild(elm)
	}
}

// Get the client rect of a character range in a line
function getRect(start: number, end: number, lineElm: Element): DOMRect {
	function findNodeAndOffset(targetLength: number, lineElm: Element): [Node, number] {
		const walker = document.createTreeWalker(lineElm, NodeFilter.SHOW_TEXT)
		let length = 0
		let node

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

function strToHue(str: string) {
	let hash = 0

	for (let i = 0; i < str.length; i++)
			hash = str.charCodeAt(i) + ((hash << 5) - hash)

	return hash % 360
}
