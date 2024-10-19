import { Editor } from '../src'
import { isAndroid, isFirefox, isIOS } from '../src/utils'

const editor = new Editor('editor', {
	content: '# Hello, World!\nThis is `mark-ed`, an in-browser editor that supports Markdown formatting.\n\n[**View on GitHub**](https://github.com/slugcat-dev/mark-ed)',
	hideMarks: true
})

// Custom smooth animated caret
const caret = editor.root.parentElement!.querySelector('.selection-layer > .caret') as HTMLElement

// Don't apply on mobile devices
if (!isAndroid && !isIOS) {
	editor.root.style.caretColor = 'transparent'

	editor.addEventListener('selectionchange', () => {
		const selection = document.getSelection()
		let caretVisible = false

		// Calculate the caret position
		if (editor.focused && selection && selection.focusNode) {
			const range = document.createRange()
			const focusNode = selection.focusNode

			range.setStart(focusNode, selection.focusOffset)
			range.collapse(true)

			const rangeRect = range.getBoundingClientRect()
			const caretRect = DOMRect.fromRect(rangeRect)
			const editorRect = editor.root.getBoundingClientRect()

			// Fix for empty lines
			if (focusNode instanceof HTMLElement) {
				let innermostChild = focusNode

				while (innermostChild.firstChild instanceof HTMLElement)
					innermostChild = innermostChild.firstChild

				const lineRect = innermostChild.getBoundingClientRect()
				const computedStyle = getComputedStyle(innermostChild)
				const fontSize = parseFloat(computedStyle.fontSize)
				const caretHeight = lineRect.height - fontSize * 1.125

				caretRect.x = lineRect.x + parseFloat(computedStyle.paddingInlineStart)
				caretRect.y = lineRect.y + caretHeight / 2
				caretRect.height = lineRect.height - caretHeight
			}

			const x = Math.round(caretRect.left - editorRect.left)
			const y = Math.round(caretRect.top - editorRect.top)

			caret.style.height = `${caretRect.height}px`
			caret.style.translate = `${x}px ${y}px`

			// Sry Firefox <3
			if (!isFirefox || selection.isCollapsed)
				caretVisible = true
		}

		// Hide the caret if the editor is not focused
		caret.classList.toggle('visible', caretVisible)

		// Restart the caret blink animation
		if (caret.style.animationName === 'blink-1')
			caret.style.animationName = 'blink-2'
		else
			caret.style.animationName = 'blink-1'
	})
}
