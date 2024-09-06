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
	'Enter': (ed: Editor) => {
		// TODO: continue list quote etc
		const selection = ed.getSelection()
		const line = ed.lineAt(selection.start)
		const indent = line.text.match(/^\s*/)

		ed.insertAtSelection('\n' + indent)
	},
	'Tab': (ed: Editor) => {
		// TODO: indent lists etc
		ed.insertAtSelection('\t')
	},
	'Shift Tab': (ed: Editor) => {
		// TODO: outdent
	},
	'Esc': (ed: Editor) => ed.root.blur()
}
