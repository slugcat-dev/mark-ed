import { escapeHTML, fix } from './markdown'

export interface LineRule {
	regex: RegExp
	replace: (match: RegExpExecArray) => string
}

export interface BlockRule {
	open: (line: string) => { match: RegExpExecArray, replacement: string } | false
	close: (line: string, openMatch: RegExpExecArray) => string | false
	replace: (line: string) => string
}

export interface InlineRule {
	regex: RegExp
	replace: (match: RegExpExecArray) => string
}

export interface LineGrammar {
	[key: string]: LineRule | BlockRule
}

export interface InlineGrammar {
	[key: string]: InlineRule
}

export const defaultLineGrammar: LineGrammar = {
	ThematicBreak: {
		regex: /^(?<indent>\s*)(?<mark>(?:(?:\*\s*){3,})|(?:(?:-\s*){3,})|(?:(?:_\s*){3,}))(?<end>\s*)$/,
		replace(match: RegExpExecArray) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const end = match.groups!.end

			return `<div class="md-hr">${indent}<span class="md-mark">${mark}</span>${end}</div>`
		}
	},
	ATXHeading: {
		regex: /^(?<indent>\s*)(?<mark>#{1,6}\s)(?<text>.*)$/,
		replace(match: RegExpExecArray) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const text = fix(match.groups!.text)
			const level = mark.length - 1

			return `<h${level} class="md-heading">${indent}<span class="md-mark">${mark}</span>${text}</h${level}>`
		}
	},
	Subtext: {
		regex: /^(?<indent>\s*)(?<mark>-#\s)(?<text>.*)$/,
		replace(match: RegExpExecArray) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const text = fix(match.groups!.text)

			return `<span class="md-subtext">${indent}<span class="md-mark">${mark}</span>${text}</span>`
		}
	},
	CodeBlock: {
		open(line: string) {
			const match = /^(?<indent>\s*)(?<mark>`{3,})(?<lang>[^\s]*)(?<rest>.*)$/.exec(line)

			if (!match)
				return false

			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const lang = escapeHTML(match.groups!.lang)
			const rest = escapeHTML(match.groups!.rest)

			return {
				match,
				replacement: `<code class="md-code-block">${indent}<span class="md-mark">${mark}</span>${lang.length > 0 ? `<span class="md-code-lang">${lang}</span>` : ''}${rest}</code>`
			}
		},
		close(line: string, openMatch: RegExpExecArray) {
			const openMark = openMatch.groups!.mark
			const match = RegExp(`^(?<indent>\\s*)(?<mark>\`{${openMark.length},})$`).exec(line)

			if (!match)
				return false

			const indent = match.groups!.indent
			const mark = match.groups!.mark

			return `<code class="md-code-block">${indent}<span class="md-mark">${mark}</span></code>`
		},
		replace: (line: string) => `<code class="md-code-block">${fix(line)}</code>`
	},
	BlockQuote: {
		regex: /^(?<indent>\s*)(?<mark>>)(?<text>.*)/,
		replace(match: RegExpExecArray) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const text = escapeHTML(match.groups!.text)

			return `<div class="md-quote">${indent}<span class="md-mark">${mark}</span>${text}</div>`
		}
	}
}

// TODO:
export const defaultInlineGrammar: InlineGrammar = {
	Italic: {
		regex: /\_(.+?)\_/g,
		replace: (match) => `<i><span class="md-mark">_</span>${match[1]}<span class="md-mark">_</span></i>`
	},
	Bold: {
		regex: /\*\*(.+?)\*\*/g,
		replace: (match) => `<strong><span class="md-mark">**</span>${match[1]}<span class="md-mark">**</span></strong>`
	},
	InlineCode: {
		regex: /`(.+?)`/g,
		replace: (match) => `<code class="md-code"><span class="md-mark">\`</span>${match[1]}<span class="md-mark">\`</span></code>`
	},
	Strikethrough: {
		regex: /~~(.+?)~~/g,
		replace: (match) => `<del><span class="md-mark">~~</span>${match[1]}<span class="md-mark">~~</span></del>`
	},
}
