// TODO:
// - Inline pass-on
// - list
// - docstrings

import { type BlockRule, defaultLineGrammar, defaultInlineGrammar, type InlineGrammar } from './grammar'

const punctuation = /[\p{S}|\p{P}]/u
const autolinkStart = /(https?:\/\/[^\W_])|[^\W_](?:[\w.+-]*[^\W_])?@[^\W_]/giy
const urlEnd = /(?:[\w-]*[^\W_])?(?:\.[^\W_](?:[\w-]*[^\W_])?)*(?::\d{1,5})?(?:\/[^\s<]*)?/gy
const emailEnd = /(?:[\w-]*[^\W_])?[\w-]*(?:\.[^\W_](?:[\w-]*[^\W_])?)+/gy

export class MarkdownParser {
	private lineGrammar = defaultLineGrammar
	private inlineGrammar = defaultInlineGrammar
	lines: string[] = []
	lineTypes: (string | null)[] = []

	constructor() {
		// TODO: custom grammar
	}

	parse(lines: string[]): string[] {
		let openType = null
		let openMatch = null

		this.lines = []
		this.lineTypes = []

		for (let lineNum = 0; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum]
			let lineType = null
			let html = parseInline(line)

			if (openType) {
				lineType = openType

				const rule = this.lineGrammar[lineType] as BlockRule
				const close = rule.close(line, openMatch!)

				if (close) {
					openType = null
					openMatch = null
					html = close
				} else
					html = rule.replace(line)
			} else {
				for (const type in this.lineGrammar) {
					const rule = this.lineGrammar[type]

					if ('regex' in rule) {
						const match = rule.regex.exec(line)

						if (match) {
							lineType = type
							html = rule.replace(match)

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
}

/**
 * Insert `<br>` for empty lines and escape special HTML characters.
 */
export function fix(line: string): string {
	if (line.length === 0)
		return '<br>'

	return escapeHTML(line)
}

/**
 * Escape special HTML characters in a string.
 */
export function escapeHTML(str: string): string {
	return str
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('&', '&amp;')
}

// TODO: tmp
export function parseInline(text: string, grammar: InlineGrammar = defaultInlineGrammar): string {
  let result = fix(text);
  for (const rule of Object.values(grammar)) {
    result = result.replace(rule.regex, (match, ...args) => {
      const execArray = [match, ...args];
      return rule.replace(execArray as RegExpExecArray);
    });
  }
  return result;
}
