import { defaultLineGrammar, defaultInlineGrammar, type LineGrammar, type InlineGrammar, type BlockRule } from './grammar'

export interface MarkdownParserConfig {
	lineGrammar: LineGrammar
	inlineGrammar: InlineGrammar
}

export class MarkdownParser {
	private lineGrammar: LineGrammar
	private inlineGrammar: InlineGrammar
	lines: string[] = []
	lineTypes: string[] = []

	constructor(config?: Partial<MarkdownParserConfig>) {
		this.lineGrammar = config?.lineGrammar ?? defaultLineGrammar
		this.inlineGrammar = config?.inlineGrammar ?? defaultInlineGrammar
	}

	parse(lines: string[]): string[] {
		let openType = null
		let openMatch = null

		this.lines = []
		this.lineTypes = []

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum]
			let lineType = 'Default'
			let html = this.parseInline(line)

			if (openType) {
				lineType = openType

				const rule = this.lineGrammar[lineType] as BlockRule
				const close = rule.close(line, openMatch!, this)

				if (close) {
					openType = null
					openMatch = null
					html = close
				} else
					html = rule.line(line, this)
			} else {
				for (const type in this.lineGrammar) {
					const rule = this.lineGrammar[type]

					if ('regex' in rule || 'match' in rule) {
						const match = 'regex' in rule
							? rule.regex.exec(line)
							: rule.match(line)

						if (match) {
							lineType = type
							html = rule.replace(match, this)

							break
						}
					} else {
						const open = rule.open(line, this)

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

	parseInline(string: string): string {
		const stack = []
		let str = string
		let pos = 0
		let res = ''

		// Precompute the delimiter regex
		const delimiters = Object.values(this.inlineGrammar)
			.reduce((delimiters, rule) => {
				if ('delimiter' in rule && !delimiters.includes(rule.delimiter))
					delimiters += rule.delimiter

				return delimiters
			}, '')
			.replace(/[-\\\]^]/g, '\\$&')
		const delimiterRegex = new RegExp(`^([${delimiters}])\\1*`)

		outer: while (str) {
			// Match-and-replace rules
			for (const type in this.inlineGrammar) {
				const rule = this.inlineGrammar[type]

				if ('regex' in rule || 'match' in rule) {
					const match = 'regex' in rule
							? rule.regex.exec(str)
							: rule.match(str)

					if (match) {
						str = str.substring(match[0].length)
						pos += match[0].length
						res += rule.replace(match, this)

						continue outer
					}
				}
			}

			// Delimiter rules
			const match = delimiterRegex.exec(str)

			if (match) {
				const delimiter = match[1]
				let len = match[0].length

				str = str.substring(len)

				// Check if the delimiter run can open or close
				const preceding = pos > 0 ? string.substring(0, pos) : ' '
				const following = pos + len < string.length ? str : ' '
				const punctuationFollows = following.match(/^[\p{S}|\p{P}]/u)
				const punctuationPrecedes = preceding.match(/[\p{S}|\p{P}]$/u)
				const whitespaceFollows = following.match(/^\s/)
				const whitespacePrecedes = preceding.match(/\s$/)

				// Check right-flanking and left-flanking
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

				// Don't allow an intraword delimiter run with a single underscore
				if (delimiter === '_' && len === 1 && canOpen && canClose) {
					canOpen = !!punctuationPrecedes
					canClose = !!punctuationFollows
				}

				// If the delimiter run can close, check if there are matching open delimiters on the stack
				if (canClose) {
					let stackPointer = stack.length - 1

					while (len && stackPointer >= 0) {
						if (stack[stackPointer].delimiter === delimiter) {
							// Pop skipped (non-matching) delimiters from the stack
							while (stackPointer < stack.length - 1) {
								const entry = stack.pop()!

								res = `${entry.res}${entry.delimiter.repeat(entry.len)}${res}`
							}

							// Find a matching rule for the delimiter
							const openLen = stack[stackPointer].len
							const rule = Object.values(this.inlineGrammar)
								.filter(rule => 'delimiter' in rule)
								.sort((a, b) => b.length - a.length)
								.find(rule => rule.delimiter.includes(delimiter)
									&& len >= rule.length
									&& openLen >= rule.length)

							if (rule) {
								res = rule.replace(delimiter.repeat(rule.length), res)
								len -= rule.length
								stack[stackPointer].len -= rule.length
							} else {
								// If no matching rule is found, append the unused characters to the result
								res = `${res}${delimiter.repeat(len)}`
								len = 0
							}

							// Pop the stack entry if it is now empty
							if (stack[stackPointer].len <= 0) {
								const entry = stack.pop()!

								res = `${entry.res}${res}`
								stackPointer--
							}
						} else
							stackPointer--
					}
				}

				// If there are still characters left and the delimiter run can open, push it on the stack
				if (len && canOpen) {
					stack.push({
						delimiter,
						len,
						res
					})

					// The processed output has been pushed on the stack and will be prepended when the stack gets popped
					res = ''
					len = 0
				}

				pos += match[0].length

				// Append unused characters to the output
				if (len)
					res = `${res}${match[0].substring(0, len)}`

				continue outer
			}

			// Advance to the next character
			res += escapeHTML(str.substring(0, 1))
			str = str.substring(1)
			pos++
		}

		// Empty the stack, any delimiters left are unused
		while (stack.length) {
			const entry = stack.pop()!

			res = `${entry.res}${entry.delimiter.repeat(entry.len)}${res}`
		}

		if (res.length === 0)
			return '<br>'

		return res
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
