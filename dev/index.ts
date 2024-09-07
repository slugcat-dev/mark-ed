import { Editor } from '../src/index'

const editor = new Editor('editor', {
	content: '# Hello, World!\n**wee** markdown works\n`=^∙∙^=`',
	keymap: {
		'Alt ArrowUp': () => moveLine(true),
		'Alt ArrowDown': () => moveLine(false),
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
