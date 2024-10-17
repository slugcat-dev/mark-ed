import { escapeHTML, fixLine, type MarkdownParser } from './markdown'

export interface Match {
	[key: number]: string
	groups?: {
		[key: string]: string
	}
}

export interface ReplaceRule {
	match: (str: string) => Match | false
	replace: (match: Match, parser: MarkdownParser) => string
}

export interface RegexReplaceRule {
	regex: RegExp
	replace: (match: Match, parser: MarkdownParser) => string
}

export interface BlockRule {
	open: (line: string, parser: MarkdownParser) => { match: Match, replacement: string } | false
	line: (line: string, parser: MarkdownParser) => string
	close: (line: string, openMatch: Match, parser: MarkdownParser) => string | false
}

export interface DelimiterRule {
	delimiter: string
	length: number
	replace: (delimiter: string, text: string) => string
}

export interface LineGrammar {
	[key: string]: ReplaceRule | RegexReplaceRule | BlockRule
}

export interface InlineGrammar {
	[key: string]: ReplaceRule | RegexReplaceRule | DelimiterRule
}

export const defaultLineGrammar: LineGrammar = {
	ThematicBreak: {
		regex: /^(\s*)((?:(?:\*\s*){3,})|(?:(?:-\s*){3,})|(?:(?:_\s*){3,}))(\s*)$/,
		replace: match => `<span class="md-hr">${match[1]}<span class="md-mark">${match[2]}</span>${match[3]}</span>`
	},
	ATXHeading: {
		regex: /^([\t ]*)(#{1,6} )(.*?)((?:\s+#+\s*)?)$/,
		replace(match, parser) {
			const mark = match[2]
			const level = mark.length - 1
			const end = match[4].length ? `<span class="md-mark">${match[4]}</span>` : ''

			return `${match[1]}<h${level} class="md-heading" style="display: inline"><span class="md-mark">${mark}</span>${parser.parseInline(match[3])}${end}</h${level}>`
		}
	},
	CodeBlock: {
		open(line) {
			const match = /^([\t ]*)(`{3,})(\s*)([^\s`]*)([^`]*)$/.exec(line)

			if (!match)
				return false

			const lang = match[4] ? `<span class="md-code-lang">${escapeHTML(match[4])}</span>` : ''

			return {
				match,
				replacement: `<code class="md-code-block md-open">${match[1]}<span class="md-mark">${match[2]}${match[3]}${lang}${escapeHTML(match[5])}</span></code>`
			}
		},
		line: line => `<code class="md-code-block">${fixLine(line)}</code>`,
		close(line, openMatch) {
			const openMark = openMatch[2]
			const match = RegExp(`^(\\s*)(\`{${openMark.length},})(\\s*)$`).exec(line)

			if (!match)
				return false

			return `<code class="md-code-block md-close">${match[1]}<span class="md-mark">${match[2]}</span>${match[3]}</code>`
		}
	},
	BlockQuote: {
		regex: /^([\t ]*)(> ?)(.*)/,
		replace: (match, parser) => `<span class="md-quote">${match[1]}<span class="md-mark">${escapeHTML(match[2])}</span>${parser.parseInline(match[3])}</span>`
	},
	TaskList: {
		regex: /^([\t ]*)([-+*] \[[x ]\] )(.*)/i,
		replace: (match, parser) => {
			const mark = match[2]
			const checkbox = `<span class="md-checkbox" contenteditable="false"><input type="checkbox" tabindex="-1" aria-hidden="true" ${/\[ \]/.test(mark) ? '' : 'checked'}></span>`

			return `${match[1]}<span class="md-task">${checkbox}<span class="md-mark">${mark[0]} [<span class="md-checkmark">${mark[3]}</span>]</span></span> ${parser.parseInline(match[3])}`
		}
	},
	UnorderedList: {
		regex: /^[\t ]*[-+*] .*/,
		replace: (match, parser) => parser.parseInline(match[0])
	},
	OrderedList: {
		regex: /^[\t ]*\d+[).] .*/,
		replace: (match, parser) => parser.parseInline(match[0])
	}
}

export const defaultInlineGrammar: InlineGrammar = {
	Escape: {
		regex: /^\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/,
		replace: (match: Match) => `<span class="md-escape"><span class="md-mark">\\</span>${escapeHTML(match[1])}</span>`
	},
	Autolink: {
		// Match links and E-Mail adresses enclosed in < and >
		regex: /^<([a-z][a-z\d+.-]{1,31}:[^\s<>]+|[a-z\d](?:[\w!#$%&'*+\-./=?^`{|}~]*[a-z\d])?(@)[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*)>/i,
		replace(match: Match) {
			const link = escapeHTML(match[1])
			const href = (match[2] === '@' ? 'mailto:' : '') + link.replaceAll('"', '&quot;')

			return `<span class="md-autolink"><span class="md-mark">&lt;</span><a href="${href}">${link}</a><span class="md-mark">&gt;</span></span>`
		}
	},
	InlineCode: {
		match(str) {
			if (!str.startsWith('`'))
				return false

			let pos = 1

			while (pos < str.length && str[pos] === '`')
				pos++

			const size = pos
			let curSize = 0

			for (; pos < str.length; pos++) {
				if (str[pos] === '`') {
					curSize++

					if (curSize === size && str[pos + 1] !== '`') {
						const match = str.substring(0, pos + 1)
						const text = str.substring(size, pos - size + 1)
						const mark = str.substring(0, size)

						return [match, text, mark]
					}
				} else
					curSize = 0
			}

			return false
		},
		replace: (match: Match) => `<code class="md-code"><span class="md-mark">${match[2]}</span>${escapeHTML(match[1])}<span class="md-mark">${match[2]}</span></code>`
	},
	URL: {
		// Parse literal URLs starting with `http://` or `https://`
		match(str) {
			const urlRegex = /^(https?:\/\/[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*(?::\d{1,5})?)((?:\/[^\s<>]*)?)/i
			const match = urlRegex.exec(str)

			if (!match)
				return false

			const urlStart = match[1]
			const urlEnd = match[2]
			let end = urlEnd.length

			// Count the occurances of a character in a string
			function count(char: string): number {
				let num = 0

				for (let i = 0; i < end; i++) {
					if (urlEnd[i] === char)
						num++
				}

				return num
			}

			// Handle special characters at the end and balance parentheses
			for (;;) {
				const last = urlEnd[end - 1]

				if (/[!"'*,.:;?_~]/.test(last) || (last === ')' && count(')') > count('(')))
					end--
				else
					break
			}

			return [urlStart + urlEnd.substring(0, end)]
		},
		replace: (match: Match) => `<a href="${escapeHTML(match[0])}">${escapeHTML(match[0])}</a>`
	},
	Email: {
		// Parse literal E-Mail adresses
		regex: /^[a-z\d](?:[\w!#$%&'*+\-./=?^`{|}~]*[a-z\d])?@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+/i,
		replace: (match: Match) => `<a href="mailto:${escapeHTML(match[0])}">${escapeHTML(match[0])}</a>`
	},
	Emphasis: {
		delimiter: '*_',
		length: 1,
		replace: inline('i')
	},
	StrongEmphasis: {
		delimiter: '*',
		length: 2,
		replace: inline('b')
	},
	Underline: {
		delimiter: '_',
		length: 2,
		replace: inline('u')
	},
	Strikethrough: {
		delimiter: '~',
		length: 2,
		replace: inline('s')
	}
}

function inline(tag: string): (delimiter: string, text: string) => string {
	return (delimiter: string, text: string) => `<${tag}><span class="md-mark">${delimiter}</span>${text}<span class="md-mark">${delimiter}</span></${tag}>`
}

export const defaultBlockHideRules: Record<string, string> = {
	BlockQuote: '.md-quote > .md-mark',
	CodeBlock: '.md-code-block > .md-mark'
}

export const disableRule: ReplaceRule = {
	match: () => false,
	replace: () => ''
}
