import { Editor } from './editor'
import { isMac } from './utils'

export interface Keymap {
	[key: string]: (editor: Editor) => void
}

export interface CompiledKeybind {
	key: string
	ctrlKey: boolean
	metaKey: boolean
	shiftKey: boolean
	altKey: boolean
	handler: (editor: Editor) => void
}

export const defaultKeymap: Keymap = {
	// To properly insert newlines
	'Enter': insertNewlineAndIndent,
	// TODO: insert blank line
	'Shift Enter': insertNewlineAndIndent,

	// To allow moving the focus away from the editor with the keyboard
	'Escape': (editor) => {
		document.getSelection()?.removeAllRanges()
		editor.root.blur()
	},

	// Disable undo / redo, history doesn't work anyways
	'Ctrl Z': () => {},
	'Ctrl Y': () => {},

	// Indentation
	'Tab': (editor) => {
		const selection = editor.getSelection()
		const startLine = editor.lineAt(selection.start)
		const endLine = editor.lineAt(selection.end)
		const lineType = editor.markdown.lineTypes[startLine.num]
		const indentSpaces = ' '.repeat(editor.config.tabSize)
		const indent = editor.config.indentWithSpaces ? indentSpaces : '\t'

		// Indent selected lines or list item and adjust the selections start and end positions
		if (startLine.num !== endLine.num || lineType.includes('List')) {
			for (let lineNum = startLine.num; lineNum <= endLine.num; lineNum++) {
				const line = editor.lines[lineNum]
				const lineIndent = line.match(/^\s*/)![0]
				const newIndent = indent + (
					editor.config.indentWithSpaces
					? lineIndent.replaceAll('\t', indentSpaces)
					: lineIndent.replaceAll(indentSpaces, '\t')
				)

				editor.lines[lineNum] = newIndent + line.substring(lineIndent.length)

				if (lineNum === startLine.num)
					selection.start += newIndent.length - lineIndent.length

				selection.end += newIndent.length - lineIndent.length
			}

			editor.updateDOM(selection)
		} else
			editor.insertAtSelection(indent)
	},
	'Shift Tab': (editor) => {
		const selection = editor.getSelection()
		const startLine = editor.lineAt(selection.start)
		const endLine = editor.lineAt(selection.end)
		const indentSpaces = ' '.repeat(editor.config.tabSize)
		const indent = editor.config.indentWithSpaces ? indentSpaces : '\t'
		const selectionEnd = selection.end

		for (let lineNum = startLine.num; lineNum <= endLine.num; lineNum++) {
			const line = editor.lines[lineNum]
			const lineIndent = line.match(/^\s*/)![0]
			const lineIndentSpaces = lineIndent.replaceAll('\t', indentSpaces)
			const lineIndentTabs = lineIndent.replaceAll(indentSpaces, '\t')

			// Outdent the line if possible and adjust the selections start and end positions
			if (lineIndentSpaces.length >= indentSpaces.length) {
				const newIndent = (
					editor.config.indentWithSpaces
					? lineIndentSpaces
					: lineIndentTabs
				).substring(indent.length)

				editor.lines[lineNum] = newIndent + line.substring(lineIndent.length)

				if (lineNum === startLine.num && selection.start > startLine.from)
					selection.start -= indent.length

				if (lineNum !== endLine.num || selectionEnd - endLine.from >= lineIndent.length)
					selection.end -= indent.length
			}
		}

		editor.updateDOM(selection)
	},

	// Other keybinds
	'Home': (editor) => {
		const selection = editor.getSelection()
		const pos = selection.start
		const line = editor.lineAt(pos)
		const lineType = editor.markdown.lineTypes[line.num]
		let newPos = line.from

		// Move the cursor to the start of a list item or block quote
		if (/BlockQuote|List/.test(lineType)) {
			const from = line.from + line.text.match(/^\s*(?:[-+*>]|\d+[).])\s*/)![0].length

			if (pos > from)
				newPos = from
		}

		// const indent = line.text.match(/^\s*/)![0]
		//
		// if (pos - line.from === 0 && indent.length > 0)
		//	newPos = line.from + indent.length

		editor.setSelection(newPos)
	}
}

function insertNewlineAndIndent(editor: Editor): void {
	const selection = editor.getSelection()
	const line = editor.lineAt(selection.start)
	const indent = line.text.match(/^\s*/)![0]

	editor.insertAtSelection('\n' + indent)
}

export function compileKeymap(keymap: Keymap): CompiledKeybind[] {
	return Object.entries(keymap).map(([key, handler]) => {
		const parts = key.toLowerCase().split(' ')
		const keybind = {
			key: parts
			.filter(k => !['ctrl', 'meta', 'shift', 'alt'].includes(k))
			.map(k => k === 'space' ? ' ' : k)
			.join(),
			ctrlKey: parts.includes('ctrl'),
			metaKey: parts.includes('meta'),
			shiftKey: parts.includes('shift'),
			altKey: parts.includes('alt'),
			handler
		}

		// Convert `meta` to `ctrl` for normal operating systems
		if (!isMac && keybind.metaKey && !keybind.ctrlKey) {
			keybind.metaKey = false
			keybind.ctrlKey = true
		}

		return keybind
	})
}
