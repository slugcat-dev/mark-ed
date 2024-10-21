import { Editor } from '../src'

const editor = new Editor('editor', {
	content: '# Hello, World!\nThis is `mark-ed`, an in-browser editor that supports Markdown formatting.\n\n[**View on GitHub**](https://github.com/slugcat-dev/mark-ed)',
	hideMarks: true,

	// Add keybinds to move selected lines up or down with Alt + Arrow Keys
	keymap: {
		'Alt ArrowUp': () => moveLine(true),
		'Alt ArrowDown': () => moveLine(false)
	},

	// Add a Markdown rule for subtext
	markdown: {
		lineGrammar: {
			Subtext: {
				regex: /^([\t ]*)(-# )(.*)$/,
				replace: (match, parser) => `${match[1]}<span class="md-subtext"><span class="md-mark">${match[2]}</span>${parser.parseInline(match[3])}</span>`
			}
		}
	}
})

function moveLine(up: boolean): void {
	const selection = editor.selection
	const startLine = editor.lineAt(selection.start)
	const endLine = editor.lineAt(selection.end)

	// Dont move the first line up or the last line down
	if (up) {
		if (startLine.num === 0)
			return
	} else if (endLine.num === editor.lines.length - 1)
		return

	// Move selected lines
	const lineBefore = editor.line(up ? startLine.num - 1 : endLine.num + 1)
	const linesToMove = editor.lines.slice(startLine.num, endLine.num + 1)

	editor.lines.splice(startLine.num, linesToMove.length)
	editor.lines.splice(startLine.num - (up ? 1 : -1), 0, ...linesToMove)

	// Also move the selection
	const start = up
		? lineBefore.from + (selection.start - startLine.from)
		: lineBefore.text.length + selection.start + 1
	const end = start + (selection.end - selection.start)

	editor.updateDOM({ start, end })
}

// Button to toggle Markdown syntax visibility
const btn = document.getElementById('toggleMarks')!

btn.addEventListener('click', () => {
	const hideMarks = btn.dataset.hideMarks !== 'true'

	btn.dataset.hideMarks = hideMarks.toString()
	btn.textContent = `${hideMarks ? 'Show' : 'Hide'} Markdown syntax`
	editor.config.hideMarks = hideMarks

	editor.updateDOM()
})
