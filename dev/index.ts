import { Editor } from '../src/index'

const editor = new Editor('editor', {
	content: '# Hello, World!\nThis is `mark-ed`, an in-browser editor that supports Markdown formatting.\n\n**View on GitHub:**\nhttps://github.com/slugcat-dev/mark-ed',
	hideMarks: true,
	keymap: {
		'Alt ArrowUp': () => moveLine(true),
		'Alt ArrowDown': () => moveLine(false),
	},
	markdown: {
		lineGrammar: {
			Subtext: {
				regex: /^(?<indent>[\t ]*)(?<mark>-# )(?<text>.*)$/,
				replace(match, parser) {
					const indent = match.groups!.indent
					const mark = match.groups!.mark
					const text = parser.parseInline(match.groups!.text)

					return `${indent}<span class="md-subtext"><span class="md-mark">${mark}</span>${text}</span>`
				}
			}
		}
	}
})

function moveLine(up: boolean) {
	const selection = editor.getSelection()
	const startLine = editor.lineAt(selection.start)
	const endLine = editor.lineAt(selection.end)

	if (up) {
		if (startLine.num === 0)
			return
	} else if (endLine.num === editor.lines.length - 1)
		return

	// Move lines
	const lineBefore = editor.line(up ? startLine.num - 1 : endLine.num + 1)
	const linesToMove = editor.lines.slice(startLine.num, endLine.num + 1)

	editor.lines.splice(startLine.num, linesToMove.length)
	editor.lines.splice(startLine.num - (up ? 1 : -1), 0, ...linesToMove)

	// Also move the selection
	if (up) {
		const start = lineBefore.from + (selection.start - startLine.from)
		const end = start + (selection.end - selection.start)

		editor.updateDOM({ start, end })
	} else {
		const start = lineBefore.text.length + selection.start + 1
		const end = start + (selection.end - selection.start)

		editor.updateDOM({ start, end })
	}
}

const btn = document.getElementById('toggleMarks')!

btn.addEventListener('click', () => {
	let hideMarks = btn.dataset.hideMarks !== 'true'

	btn.dataset.hideMarks = hideMarks.toString()
	btn.textContent = `${hideMarks ? 'Show' : 'Hide'} Markdown syntax`
	editor.config.hideMarks = hideMarks

	editor.updateDOM()
})
