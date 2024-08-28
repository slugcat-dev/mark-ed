import { EditorDoc } from "./doc"
import type { EditorSelection, Line } from "./types"

export class EditorState extends EventTarget {
	readonly doc = new EditorDoc()
	private _selection: EditorSelection = { start: 0, end: 0 }
	private _lines: string[] = [] // TODO sry

	constructor() {
		super()
	}

	lineAt(pos: number): Line {
		if (pos < 0 || pos > this.content.length)
			throw new RangeError(`Invalid position ${pos} in document of length ${this.content.length}`)

		let num = 0
		let len = 0

		for (const line of this.lines) {
			if (len + line.length >= pos)
				break

			len += line.length + 1
			num++
		}

		const text = this.lines[num]
		const start = len
		const end = start + text.length

		return {
			start,
			end,
			num,
			text
		}
	}

	line(num: number): void {
		// TODO
	}

	get lines(): string[] {
		return [...this._lines]
	}

	get selection(): EditorSelection {
		return this._selection
	}

	set selection(selection: EditorSelection) {
		this._selection = selection

		this.dispatchEvent(new Event('selectionchange'))
	}

	get content(): string {
		return this.lines.join('\n')
	}

	set content(content: string) {
		this._lines = content.split('\n')

		this.dispatchEvent(new Event('contentchange'))
	}

	clearLines(): void {
		this._lines = []
	}

	setLines(lines: string[]): void {
		this._lines = lines
	}
	// TODO: sipatch evt
}
