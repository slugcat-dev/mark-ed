import { Editor, EditorSelection, Line } from './editor'
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

export function compileKeymap(keymap: Keymap): CompiledKeybind[] {
	return Object.entries(keymap).map(([key, handler]) => {
		const parts = key.toLowerCase().split(' ')

		// Convert modifiers for macOS and normal operating systems
		let ctrlKey = parts.includes('ctrl')
		let metaKey = parts.includes('meta')
		let altKey = parts.includes('alt')

		if (isMac) {
			metaKey = metaKey || parts.includes('ctrlmeta')
			altKey = altKey || parts.includes('ctrlalt')
		} else
			ctrlKey = ctrlKey || parts.includes('ctrlmeta') || parts.includes('ctrlalt')

		const keybind = {
			key: parts
			.filter(k => !['ctrl', 'meta', 'shift', 'alt', 'ctrlmeta', 'ctrlalt'].includes(k))
			.map(k => k === 'space' ? ' ' : k)
			.join(),
			ctrlKey,
			metaKey,
			altKey,
			shiftKey: parts.includes('shift'),
			handler
		}

		return keybind
	})
}

export const defaultKeymap: Keymap = {
	// Properly insert newlines
	'Enter': insertNewlineAndIndent,
	'Shift Enter': (editor) => editor.insertAtSelection('\n'),

	// Allow moving the focus away from the editor with the keyboard
	'Escape': (editor) => {
		document.getSelection()?.removeAllRanges()
		editor.root.blur()
	},

	// Disable undo / redo, history doesn't work anyways
	'CtrlMeta Z': () => {},
	'CtrlMeta Y': () => {},

	// Other keybinds
	'Tab': indent,
	'Shift Tab': outdent,
	'Backspace': deleteChar,
	'Shift Backspace': deleteChar,
	'Home': (editor) => selectLineStart(editor, true),
	'Shift Home': (editor) => selectLineStart(editor, false)
}

const quoteListRegex = /^[\t ]*(?:> ?|[-+*] \[[x ]\] |[-+*] |\d+[).] )/i

function insertNewlineAndIndent(editor: Editor): void {
	const selection = editor.getSelection()
	const line = editor.lineAt(selection.start)
	const lineType = editor.markdown.lineTypes[line.num]

	if (/BlockQuote|List/.test(lineType) && selection.start === selection.end) {
		const regex = lineType === 'OrderedList'
			? /^(?<indent>[\t ]*)(?<num>\d+)(?<mark>[).] )/
			: /^(?<indent>[\t ]*)(?<mark>> ?|[-+*] \[[x ]\] |[-+*] )/i

		const parts = line.text.match(regex)!
		const indent = parts.groups!.indent
		let mark = parts.groups!.mark

		if (lineType === 'OrderedList')
			mark = Number.parseInt(parts.groups!.num) + 1 + mark
		else if (lineType === 'TaskList')
			mark = mark.replace(/x/i, ' ')

		continueMarkup(editor, selection, line, indent, mark)
	} else {
		const indent = line.text.match(/^[\t ]*/)![0]

		editor.insertAtSelection('\n' + indent)
	}
}

function continueMarkup(editor: Editor, selection: EditorSelection, line: Line, indent: string, mark: string): void {
	const text = line.text.substring(indent.length + mark.length)

	if (selection.start < line.from + indent.length + mark.length)
		editor.insertAtSelection('\n' + indent)
	else if (text.length > 0)
		editor.insertAtSelection('\n' + indent + mark)
	else {
		editor.lines[line.num] = indent

		editor.updateDOM(Editor.selectionFrom(selection.start - mark.length))
	}
}

function indent(editor: Editor): void {
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
			const lineIndent = line.match(/^[\t ]*/)![0]
			const newIndent = indent + (
				indent === '\t'
				? lineIndent.replaceAll(indentSpaces, '\t')
				: lineIndent.replaceAll('\t', indentSpaces)
			)

			editor.lines[lineNum] = newIndent + line.substring(lineIndent.length)

			if (lineNum === startLine.num)
				selection.start += newIndent.length - lineIndent.length

			selection.end += newIndent.length - lineIndent.length
		}

		editor.updateDOM(selection)
	} else
		editor.insertAtSelection(indent)
}

function outdent(editor: Editor): void {
	const selection = editor.getSelection()
	const startLine = editor.lineAt(selection.start)
	const endLine = editor.lineAt(selection.end)
	const indentSpaces = ' '.repeat(editor.config.tabSize)
	const indent = editor.config.indentWithSpaces ? indentSpaces : '\t'
	const selectionEnd = selection.end

	for (let lineNum = startLine.num; lineNum <= endLine.num; lineNum++) {
		const line = editor.lines[lineNum]
		const lineIndent = line.match(/^[\t ]*/)![0]
		const lineIndentSpaces = lineIndent.replaceAll('\t', indentSpaces)
		const lineIndentTabs = lineIndent.replaceAll(indentSpaces, '\t')
		const newIndent = (
			indent === '\t'
			? lineIndentTabs
			: lineIndentSpaces
		).substring(indent.length)

		// Outdent the line if possible and adjust the selections start and end positions
		if (lineIndentSpaces.length >= indentSpaces.length) {
			editor.lines[lineNum] = newIndent + line.substring(lineIndent.length)

			if (lineNum === startLine.num && selection.start > startLine.from)
				selection.start -= lineIndent.length - newIndent.length

			if (lineNum !== endLine.num || selectionEnd - endLine.from >= lineIndent.length)
				selection.end -= lineIndent.length - newIndent.length
		}
	}

	editor.updateDOM(selection)
}

function deleteChar(editor: Editor): void {
	const selection = editor.getSelection()

	// Delete list marks and indentation
	if (selection.start === selection.end) {
		if (selection.start === 0)
			return

		const line = editor.lineAt(selection.start)
		const lineType = editor.markdown.lineTypes[line.num]
		const lineIndent = line.text.match(/^[\t ]*/)![0]
		let pos = selection.start - 1

		if (/BlockQuote|List/.test(lineType)) {
			const markLength = line.text.match(quoteListRegex)![0].length - lineIndent.length

			if (selection.start === line.from + lineIndent.length + markLength)
				pos -= markLength - 1
		} else if (selection.start === line.from + lineIndent.length && editor.config.indentWithSpaces)
				pos -= editor.config.tabSize - 1

		editor.lines = (editor.content.substring(0, pos) + editor.content.substring(selection.start)).split('\n')

		editor.updateDOM(Editor.selectionFrom(pos))
	} else
		editor.insertAtSelection('')
}

function selectLineStart(editor: Editor, collapse: boolean): void {
	const selection = editor.getSelection()
	const line = editor.lineAt(selection.start)
	const lineType = editor.markdown.lineTypes[line.num]
	let start = line.from

	// Move the cursor to the start of a list item or block quote
	if (/BlockQuote|List/.test(lineType) && collapse) {
		const from = line.from + line.text.match(quoteListRegex)![0].length

		if (selection.start > from)
			start = from
	}

	editor.setSelection({ start }, collapse)
}
