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
	},

	// Other keybinds
	'Home': (editor) => selectLineStart(editor, true),
	'Shift Home': (editor) => selectLineStart(editor, false)
}

function insertNewlineAndIndent(editor: Editor): void {
	const selection = editor.getSelection()
	const line = editor.lineAt(selection.start)
	const lineType = editor.markdown.lineTypes[line.num]

	if (/BlockQuote|List/.test(lineType)) {
		const regex = lineType === 'OrderedList'
			? /^(?<indent>[\t ]*)(?<num>\d+)(?<mark>[).] )/
			: /^(?<indent>[\t ]*)(?<mark>> ?|[-+*] )/

		const parts = line.text.match(regex)!
		const indent = parts.groups!.indent
		const mark = lineType === 'OrderedList'
			? Number.parseInt(parts.groups!.num) + 1 + parts.groups!.mark
			: parts.groups!.mark

		continueMarkup(editor, selection, line, indent, mark)
	} else {
		const indent = line.text.match(/^[\t ]*/)![0]

		editor.insertAtSelection('\n' + indent)
	}
}

function continueMarkup(editor: Editor, selection: EditorSelection, line: Line, indent: string, mark: string) {
	const text = line.text.substring(indent.length + mark.length)

	if (text.length > 0)
		editor.insertAtSelection('\n' + indent + mark)
	else {
		editor.lines[line.num] = indent
		selection.start = selection.end = selection.start - mark.length

		editor.updateDOM(selection)
	}
}

function selectLineStart(editor: Editor, collapse: boolean) {
	const selection = editor.getSelection()
	const line = editor.lineAt(selection.start)
	const lineType = editor.markdown.lineTypes[line.num]
	let newStart = line.from

	// Move the cursor to the start of a list item or block quote
	if (/BlockQuote|List/.test(lineType)) {
		const from = line.from + line.text.match(/^[\t ]*(?:> ?|[-+*] |\d+[).] )/)![0].length

		if (selection.start > from)
			newStart = from
	}

	selection.start = newStart

	if (collapse)
		selection.end = newStart

	editor.setSelection(selection)
}
