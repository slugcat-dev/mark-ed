import { MarkdownParser } from '../src/markdown'

const output = document.getElementById('output')!
const md = new MarkdownParser()
const lines = [
	'# Heading 1',
	'## Heading 2',
	'### Heading 3',
	'#### Heading 4',
	'##### Heading 5',
	'###### Heading 6',
	'',
	'Normal Text',
	'-# Subtext',
	'',
	'---',
	'',
	'```script',
	'code();',
	'```',
	'',
	'> Block',
	'> Quote'
]

for (const line of md.parse(lines)) {
	const lineElm = document.createElement('div')

	lineElm.className = 'md-line'
	lineElm.innerHTML = line

	output.appendChild(lineElm)
}
