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
	'',
	'```script',
	'code();',
	'```',
	'',
	'> Block',
	'> Quote'
]

output.innerHTML = md.parse(lines)
