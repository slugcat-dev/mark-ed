import { isMac } from './utils'
import { Editor } from './editor'

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
	'Shift Enter': editor => editor.insertAtSelection('\n'),

	// Allow moving the focus away from the editor with the keyboard
	'Escape': editor => {
		const selection = document.getSelection()

		if (selection)
			selection.removeAllRanges()

		editor.root.blur()
	},

	// History
	'CtrlMeta Z': editor => editor.undo(),
	'CtrlMeta Y': editor => editor.redo(),
	'CtrlMeta Shift Z': editor => editor.redo(),

	// Indentation keybinds
	'Tab': insertTabOrIndent,
	'Shift Tab': outdent,

	// Editing keybinds
	'Backspace': deleteBackward,
	'Shift Backspace': deleteBackward,

	// Navigation keybinds
	'Home': editor => selectLineStart(editor, true),
	'Shift Home': editor => selectLineStart(editor, false)
}

const quoteListRegex = /^[\t ]*(?:> ?|[-+*] \[[x ]\] |[-+*] |\d+[).] )/i

function insertNewlineAndIndent(editor: Editor): void {
	const selection = editor.selection
	const line = editor.lineAt(selection.start)
	const lineType = editor.markdown.lineTypes[line.num]
	const indent = line.text.match(/^[\t ]*/)![0]

	// Continue block quotes and lists
	if (/BlockQuote|List/.test(lineType) && selection.start === selection.end) {
		const regex = lineType === 'OrderedList'
			? /^[\t ]*(?<num>\d+)(?<mark>[).] )/
			: /^[\t ]*(?<mark>> ?|[-+*] \[[x ]\] |[-+*] )/i

		const parts = line.text.match(regex)!
		let mark = parts.groups!.mark

		if (lineType === 'OrderedList')
			mark = Number.parseInt(parts.groups!.num) + 1 + mark
		else if (lineType === 'TaskList')
			mark = mark.replace(/x/i, ' ')

		// Only continue markup if the cursor is after the mark and there is text after it
		const text = line.text.substring(indent.length + mark.length)

		if (selection.start < line.from + indent.length + mark.length)
			editor.insertAtSelection('\n' + indent)
		else if (text.length)
			editor.insertAtSelection('\n' + indent + mark)
		else {
			// If the line has no text after the mark, remove the mark
			editor.lines[line.num] = indent

			editor.updateDOM(Editor.selectionFrom(selection.start - mark.length))
		}
	} else
		editor.insertAtSelection('\n' + indent)
}

function insertTabOrIndent(editor: Editor): void {
	const selection = editor.selection
	const startLine = editor.lineAt(selection.start)
	const endLine = editor.lineAt(selection.end)
	const lineType = editor.markdown.lineTypes[startLine.num]
	const indentSpaces = ' '.repeat(editor.config.tabSize)
	const indent = editor.config.indentWithSpaces ? indentSpaces : '\t'

	// Indent selected lines or list item
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

			// Adjust the selections start and end position
			const selectionOffset = newIndent.length - lineIndent.length

			if (lineNum === startLine.num)
				selection.start += selectionOffset

			selection.end += selectionOffset
		}

		editor.updateDOM(selection)
	} else
		editor.insertAtSelection(indent)
}

function outdent(editor: Editor): void {
	const selection = editor.selection
	const startLine = editor.lineAt(selection.start)
	const endLine = editor.lineAt(selection.end)
	const indentSpaces = ' '.repeat(editor.config.tabSize)
	const indent = editor.config.indentWithSpaces ? indentSpaces : '\t'
	const selectionEnd = selection.end

	// Outdent selected lines
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

		// Outdent the line if possible and adjust the selections start and end position
		if (lineIndentSpaces.length >= indentSpaces.length) {
			editor.lines[lineNum] = newIndent + line.substring(lineIndent.length)

			const selectionOffset = lineIndent.length - newIndent.length

			if (lineNum === startLine.num && selection.start > startLine.from)
				selection.start -= selectionOffset

			if (lineNum !== endLine.num || selectionEnd - endLine.from >= lineIndent.length)
				selection.end -= selectionOffset
		}
	}

	editor.updateDOM(selection)
}

function deleteBackward(editor: Editor): void {
	const selection = editor.selection

	if (selection.start === selection.end) {
		if (selection.start === 0)
			return

		const line = editor.lineAt(selection.start)
		const lineType = editor.markdown.lineTypes[line.num]
		const lineIndent = line.text.match(/^[\t ]*/)![0]
		let pos = selection.start - 1

		// Delete block quote and list marks and indentation spaces
		if (/BlockQuote|List/.test(lineType)) {
			const markLength = line.text.match(quoteListRegex)![0].length - lineIndent.length

			if (selection.start === line.from + lineIndent.length + markLength)
				pos -= markLength - 1
		} else if (editor.config.indentWithSpaces && selection.start === line.from + lineIndent.length)
			pos -= editor.config.tabSize - 1

		editor.lines = (editor.content.substring(0, pos) + editor.content.substring(selection.start)).split('\n')

		editor.updateDOM(Editor.selectionFrom(pos))
	} else
		editor.insertAtSelection('')
}

function selectLineStart(editor: Editor, collapse: boolean): void {
	const selection = editor.selection
	const forward = selection.direction === 'forward'
	const line = editor.lineAt(forward ? selection.end : selection.start)
	const lineType = editor.markdown.lineTypes[line.num]
	let pos = line.from

	// Move the cursor to the start of a list item or block quote
	if (/BlockQuote|List/.test(lineType) && collapse) {
		const from = line.from + line.text.match(quoteListRegex)![0].length

		if (selection.start > from)
			pos = from
	}

	if (forward) {
		if (collapse || selection.start <= line.from)
			editor.setSelection({ end: pos }, collapse)
		else
			editor.setSelection({ start: pos, end: selection.start, direction: 'backward' })
	} else
		editor.setSelection({ start: pos }, collapse)
}
