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

export interface LineGrammar {
	[key: string]: LineRule | BlockRule
}

export const defaultLineGrammar: LineGrammar = {
	ThematicBreak: {
		regex: /^(?<indent>\s*)(?<mark>(?:(?:\*\s*){3,})|(?:(?:-\s*){3,})|(?:(?:_\s*){3,}))(?<end>\s*)$/,
		replace(match: RegExpExecArray) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const end = match.groups!.end

			return `<div class="md-thematic-break">${indent}<span class="md-mark">${mark}</span>${end}</div>`
		}
	},
	ATXHeading: {
		regex: /^(?<indent>\s*)(?<mark>#{1,6})(?<text>\s.*)$/,
		replace(match: RegExpExecArray) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const text = escapeHTML(match.groups!.text)
			const level = mark.length

			return `<h${level}>${indent}<span class="md-mark">${mark}</span>${text}</h${level}>`
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
				replacement: `<code>${indent}<span class="md-mark">${mark}</span>${lang.length > 0 ? `<span class="md-code-lang">${lang}</span>` : ''}${rest}</code>`
			}
		},
		close(line: string, openMatch: RegExpExecArray) {
			const openMark = openMatch.groups!.mark
			const match = RegExp(`^(?<indent>\\s*)(?<mark>\`{${openMark.length},})$`).exec(line)

			if (!match)
				return false

			const indent = match.groups!.indent
			const mark = match.groups!.mark

			return `<code>${indent}<span class="md-mark">${mark}</span></code>`
		},
		replace(line: string) {
			return `<code>${fix(line)}</code>`
		}
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
