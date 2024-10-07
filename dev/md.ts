import { MarkdownParser, defaultInlineGrammar, defaultLineGrammar } from '../src'

const output = document.getElementById('output')!
const md = new MarkdownParser({
	lineGrammar: defaultLineGrammar,
	inlineGrammar: defaultInlineGrammar
})
const lines = [
	'# Heading 1',
	'## Heading 2',
	'### Heading 3',
	'#### Heading 4',
	'##### Heading 5',
	'###### Heading 6',
	'',
	'---',
	'',
	'```script',
	'code();',
	'```',
	'',
	'> Block',
	'> Quote',
	'',
	'- [x] Task',
	'- [ ] List',
	'',
	'Normal Text',
	'',
	'Escape \\*',
	'',
	'*Italic*',
	'**Bold**',
	'__Underline__',
	'~~Strikethrough~~',
	'`Inline Code`',
	'',
	'<ssh://mainframe>',
	'http://localhost/',
	'me@mail.com'
]

for (const line of md.parse(lines)) {
	const lineElm = document.createElement('div')

	lineElm.className = 'md-line'
	lineElm.innerHTML = line

	output.appendChild(lineElm)
}
