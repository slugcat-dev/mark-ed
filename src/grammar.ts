import { escapeHTML, fixLine } from './markdown'

export interface ReplaceRule {
	regex: RegExp
	replace: (match: RegExpExecArray, parseInline: (str: string) => string) => string
}

export interface BlockRule {
	open: (line: string) => { match: RegExpExecArray, replacement: string } | false
	close: (line: string, openMatch: RegExpExecArray) => string | false
	line: (line: string) => string
}

export interface InlineReplaceRule {
	regex: RegExp
	replace: (match: RegExpExecArray) => string
}

export interface LineGrammar {
	[key: string]: ReplaceRule | BlockRule
}

export interface InlineGrammar {
	[key: string]: InlineReplaceRule
}

export const defaultLineGrammar: LineGrammar = {
	ThematicBreak: {
		regex: /^(?<indent>\s*)(?<mark>(?:(?:\*\s*){3,})|(?:(?:-\s*){3,})|(?:(?:_\s*){3,}))(?<end>\s*)$/,
		replace(match) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const end = match.groups!.end

			return `<div class="md-hr">${indent}<span class="md-mark">${mark}</span>${end}</div>`
		}
	},
	ATXHeading: {
		regex: /^(?<indent>\s*)(?<mark>#{1,6}\s)(?<text>.*)$/,
		replace(match, parseInline) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const text = parseInline(match.groups!.text)
			const level = mark.length - 1

			return `<h${level} class="md-heading">${indent}<span class="md-mark">${mark}</span>${text}</h${level}>`
		}
	},
	CodeBlock: {
		open(line) {
			const match = /^(?<indent>\s*)(?<mark>`{3,})(?<lang>[^\s]*)(?<rest>.*)$/.exec(line)

			if (!match)
				return false

			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const lang = escapeHTML(match.groups!.lang)
			const rest = escapeHTML(match.groups!.rest)

			return {
				match,
				replacement: `<code class="md-code-block">${indent}<span class="md-mark">${mark}${lang.length > 0 ? `<span class="md-code-lang">${lang}</span>` : ''}${rest}</span></code>`
			}
		},
		close(line, openMatch) {
			const openMark = openMatch.groups!.mark
			const match = RegExp(`^(?<indent>\\s*)(?<mark>\`{${openMark.length},})$`).exec(line)

			if (!match)
				return false

			const indent = match.groups!.indent
			const mark = match.groups!.mark

			return `<code class="md-code-block">${indent}<span class="md-mark">${mark}</span></code>`
		},
		line: (line) => `<code class="md-code-block">${fixLine(line)}</code>`
	},
	BlockQuote: {
		regex: /^(?<indent>\s*)(?<mark>>)(?<text>.*)/,
		replace(match, parseInline) {
			const indent = match.groups!.indent
			const mark = match.groups!.mark
			const text = parseInline(match.groups!.text)

			return `<div class="md-quote">${indent}<span class="md-mark">${mark}</span>${text}</div>`
		}
	}
}

export const defaultInlineGrammar: InlineGrammar = {
	Escape: {
		regex: /^\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/,
		replace: (match) => `<span class="md-escape"><span class="md-mark">\\</span>${escapeHTML(match[1])}</span>`
	}
}
