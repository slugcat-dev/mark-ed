import type { Editor } from './editor'
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
	'Shift Enter': insertNewlineAndIndent,

	// To allow moving the focus away from the editor with the keyboard
	'Escape': (editor) => editor.root.blur(),

	// Disable undo / redo as history doesn't function anyways
	'Ctrl Z': () => {},
	'Ctrl Y': () => {},

	// Other keybinds
	'Tab': (editor) => {
		// TODO: indent lists etc
		editor.insertAtSelection('\t')
	},
	'Shift Tab': (editor) => {
		// TODO: outdent
	}
}

function insertNewlineAndIndent(editor: Editor) {
	// TODO: continue list quote etc
	const selection = editor.getSelection()
	const line = editor.lineAt(selection.start)
	const indent = line.text.match(/^\s*/)

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
