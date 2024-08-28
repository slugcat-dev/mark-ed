import { Editor } from '../src/index'

const infoRef = document.getElementById('info')
const editorRef = document.getElementById('editor')
const editor = new Editor(editorRef, '# Editor\nHello, World')

editor.state.addEventListener('selectionchange', () => {
	const selection = editor.state.selection
	const startLine = editor.state.lineAt(selection.start)
	const endLine = editor.state.lineAt(selection.end)
	const startCharPos = selection.start - startLine.start
	const endCharPos = selection.end - endLine.start
	let infoText = `${startLine.num}:${startCharPos}`

	if (selection.start !== selection.end)
		infoText += `-${endLine.num}:${endCharPos}`

	infoText += ` | ${selection.start}${selection.start === selection.end ? '' : '-' + selection.end} | ${(editor.state.content.match(/\b\w+\b/g) || []).length} Words`

	infoRef!.textContent = infoText
})
