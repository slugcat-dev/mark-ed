// TODO:
// - Para as default
// - Inline pass-on
// - md-line wrapper
// - container blocks
// - indent

// hr
// setext
// list

// atx heading end
// code block open and close

export interface LineGrammarRule {
	regex: RegExp
	replace: (match: RegExpExecArray) => string
}

export interface BlockGrammarRule {
	open: (line: string) => { match: RegExpExecArray, replacement: string } | false
	close: (line: string, openMatch: RegExpExecArray) => string | false
	replace: (line: string) => string
}

export interface LineGrammar {
	[key: string]: LineGrammarRule | BlockGrammarRule
}

export const defaultLineGrammar: LineGrammar = {
	ATXHeading: {
		regex: /^(?<mark>#{1,6})(?<text>\s.*)/,
		replace(match: RegExpExecArray) {
			const mark = match.groups!.mark
			const lvl = mark.length
			const text = escapeHTML(match.groups!.text)

			return `<h${lvl}><span class="md-mark">${mark}</span>${text}</h${lvl}>`
		}
	},
	CodeBlock: {
		open(line: string) {
			const match = /^(?<mark>`{3,})(?<lang>.*)/.exec(line)

			if (!match)
				return false

			const mark = match.groups!.mark
			const lang = escapeHTML(match.groups!.lang)

			return {
				match,
				replacement: `<code><span class="md-mark">${mark}</span>${lang.length > 0 ? `<span class="md-code-lang">${lang}</span>` : ''}</code>`
			}
		},
		close(line: string, openMatch: RegExpExecArray) {
			const openMark = openMatch.groups!.mark
			const match = RegExp(`^(?<mark>\`{${openMark.length},})`).exec(line)

			if (!match)
				return false

			const mark = match.groups!.mark

			return `<code><span class="md-mark">${mark}</span></code>`
		},
		replace(line: string) {
			return `<code>${fix(line)}</code>`
		}
	},
	BlockQuote: {
		regex: /^(?<mark>>)(?<text>.*)/,
		replace(match: RegExpExecArray) {
			const mark = match.groups!.mark
			const text = escapeHTML(match.groups!.text)

			return `<div class="md-quote"><span class="md-mark">${mark}</span>${text}</div>`
		}
	},
	Paragraph: {
		regex: /.*/,
		replace(match: RegExpExecArray) {
			return fix(match[0])
		}
	}
}

const punctuation = /[\p{S}|\p{P}]/u
const autolinkStart = /(https?:\/\/[^\W_])|[^\W_](?:[\w.+-]*[^\W_])?@[^\W_]/giy
const urlEnd = /(?:[\w-]*[^\W_])?(?:\.[^\W_](?:[\w-]*[^\W_])?)*(?::\d{1,5})?(?:\/[^\s<]*)?/gy
const emailEnd = /(?:[\w-]*[^\W_])?[\w-]*(?:\.[^\W_](?:[\w-]*[^\W_])?)+/gy

export class MarkdownParser {
	lineGrammar = defaultLineGrammar
	lineTypes: (string | null)[] = []
	html = ''

	constructor() {

	}

	parse(lines: string[]): string {
		let openType = null
		let openMatch = null

		this.lineTypes = []
		this.html = ''

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum]
			let lineType = null

			if (openType) {
				lineType = openType

				const rule = this.lineGrammar[lineType] as BlockGrammarRule
				const close = rule.close(line, openMatch!)

				if (close) {
					openType = null
					openMatch = null
					this.html += `<div class="md-line">${close}</div>`
				} else
					this.html += `<div class="md-line">${rule.replace(line)}</div>`
			} else {
				for (const type in this.lineGrammar) {
					const rule = this.lineGrammar[type]

					if ('regex' in rule) {
						const match = rule.regex.exec(line)

						if (match) {
							lineType = type
							this.html += `<div class="md-line">${rule.replace(match)}</div>`

							break
						}
					} else {
						const open = rule.open(line)

						if (open) {
							openType = lineType = type
							openMatch = open.match
							this.html += `<div class="md-line">${open.replacement}</div>`

							break
						}
					}
				}
			}

			this.lineTypes.push(lineType)
		}

		return this.html
	}
}

/**
 * Insert `<br>` for empty lines and escape special HTML characters.
 */
function fix(line: string): string {
	if (line.length === 0)
		return '<br>'

	return escapeHTML(line)
}

/**
 * Escape special HTML characters in a string.
 */
function escapeHTML(str: string): string {
	return str
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}
