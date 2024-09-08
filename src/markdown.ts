import { defaultLineGrammar, defaultInlineGrammar, type LineGrammar, type InlineGrammar, type BlockRule } from './grammar'
import { defu } from './utils'

export interface MarkdownParserConfig {
	lineGrammar: LineGrammar
	inlineGrammar: InlineGrammar
}

const punctuationLeading = /^[\p{S}|\p{P}]/u
const punctuationTrailing = /[\p{S}|\p{P}]$/u

export class MarkdownParser {
	private lineGrammar: LineGrammar
	private inlineGrammar: InlineGrammar
	lines: string[] = []
	lineTypes: (string | null)[] = []

	constructor(config?: Partial<MarkdownParserConfig>) {
		this.lineGrammar = defu(config?.lineGrammar ?? {}, defaultLineGrammar)
		this.inlineGrammar = defu(config?.inlineGrammar ?? {}, defaultInlineGrammar)
	}

	parse(lines: string[]): string[] {
		let openType = null
		let openMatch = null

		this.lines = []
		this.lineTypes = []

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum]
			let lineType = null
			let html = this.parseInline(line)

			if (openType) {
				lineType = openType

				const rule = this.lineGrammar[lineType] as BlockRule
				const close = rule.close(line, openMatch!)

				if (close) {
					openType = null
					openMatch = null
					html = close
				} else
					html = rule.line(line)
			} else {
				for (const type in this.lineGrammar) {
					const rule = this.lineGrammar[type]

					if ('regex' in rule) {
						const match = rule.regex.exec(line)

						if (match) {
							lineType = type
							html = rule.replace(match, this.parseInline.bind(this))

							break
						}
					} else {
						const open = rule.open(line)

						if (open) {
							openType = lineType = type
							openMatch = open.match
							html = open.replacement

							break
						}
					}
				}
			}

			this.lines.push(html)
			this.lineTypes.push(lineType)
		}

		return this.lines
	}

	parseInline(str: string): string {
		let string = str
		let offset = 0
		let processed = ''
		let delimiterStack = []

		outer: while (string) {
			// Process non-delimiter rules
			for (const type in this.inlineGrammar) {
				const rule = this.inlineGrammar[type]

				if ('regex' in rule) {
					const cap = rule.regex.exec(string)

					if (cap) {
						string = string.substring(cap[0].length)
						offset += cap[0].length
						processed += rule.replace(cap)

						continue outer
					}
				}
			}

			// Check for emphasis delimiter run
			const cap = /(^\*+)|(^_+)/.exec(string)

			if (cap) {
				const delimiter = cap[0][0]
				const delimString = cap[0]
				let len = cap[0].length

				string = string.substring(len)

				const preceding = offset > 0 ? str.substring(0, offset) : ' '
				const following = offset + len < str.length ? string : ' '
				const punctuationFollows = following.match(punctuationLeading)
				const punctuationPrecedes = preceding.match(punctuationTrailing)
				const whitespaceFollows = following.match(/^\s/)
				const whitespacePrecedes = preceding.match(/\s$/)

				let canOpen = !whitespaceFollows && (
					!punctuationFollows
					|| !!whitespacePrecedes
					|| !!punctuationPrecedes
				)
				let canClose = !whitespacePrecedes && (
					!punctuationPrecedes
					|| !!whitespaceFollows
					|| !!punctuationFollows
				)

				// TODO:
				if (delimiter === '_' && canOpen && canClose) {
					canOpen = !!punctuationPrecedes
					canClose = !!punctuationFollows
				}

				if (canClose) {
					let stackPointer = delimiterStack.length - 1

					// See if we can find a matching opening delimiter, move down through the stack
					while (len && stackPointer >= 0) {
						// We found a matching delimiter, let's construct the formatted string
						if (delimiterStack[stackPointer].delimiter === delimiter) {

							// First, if we skipped any stack levels, pop them immediately (non-matching delimiters)
							while (stackPointer < delimiterStack.length - 1) {
								const entry = delimiterStack.pop()!

								processed = `${entry.output}${entry.delimString.substring(0, entry.count)}${processed}`
							}

							// Then, format the string
							if (len >= 2 && delimiterStack[stackPointer].count >= 2) {
								if (delimiter === '*')
									processed = `<strong><span class="md-mark">**</span>${processed}<span class="md-mark">**</span></strong>`
								else
									processed = `<span><span class="md-mark">__</span><ins>${processed}</ins><span class="md-mark">__</span></span>`

								len -= 2;
								delimiterStack[stackPointer].count -= 2;
							} else {
								processed = `<em><span class="md-mark">${delimiter}</span>${processed}<span class="md-mark">${delimiter}</span></em>`
								len -= 1;
								delimiterStack[stackPointer].count -= 1;
							}

							// If that stack level is empty now, pop it
							if (delimiterStack[stackPointer].count == 0) {
								const entry = delimiterStack.pop()!

								processed = `${entry.output}${processed}`;
								stackPointer--;
							}
						} else {
							// This stack level's delimiter type doesn't match the current delimiter type
							// Go down one level in the stack
							stackPointer--;
						}
					}
				}

				// If there are still delimiters left, and the delimiter run can open, push it on the stack
				if (len && canOpen) {
					delimiterStack.push({
						delimiter: delimiter,
						delimString: delimString,
						count: len,
						output: processed,
					})

					// Current formatted output has been pushed on the stack and will be prepended when the stack gets popped
					processed = ''
					len = 0
				}

				// Any delimiters that are left (closing unmatched) are appended to the output.
				if (len) {
					processed = `${processed}${delimString.substr(0, len)}`;
				}

				offset += cap[0].length;
				continue outer;
			}

			processed += string.substring(0, 1)
			string = string.substring(1)
			offset++

			continue outer
		}

		// Empty the stack, any opening delimiters are unused
		while (delimiterStack.length) {
			const entry = delimiterStack.pop()!

			processed = `${entry.output}${entry.delimString.substring(0, entry.count)}${processed}`
		}

		if (processed.length === 0)
			return '<br>'

		return processed
	}
}

/**
 * Escape special HTML characters in a string.
 */
export function escapeHTML(str: string): string {
	return str
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

/**
 * Insert `<br>` for empty lines and escape special HTML characters.
 */
export function fixLine(line: string): string {
	if (line.length === 0)
		return '<br>'

	return escapeHTML(line)
}
