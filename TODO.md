# Editor
## Bugs
- programmatically setting the selection doesn't scroll into view

## Browser Quirks
- firefox: checkboxes are not clickable
- firefox: caret in code blocks
- chrome, android: keydown event not fired on backspace, see [this](https://github.com/codemirror/view/blob/main/src/input.ts#L898) and [this](https://github.com/codemirror/view/blob/main/src/domobserver.ts#L296)
- chrome: set editor content to
	```
	Normal line
	> Quote or heading with http://link
	```
	<kbd>Ctrl</kbd><kbd>A</kbd>, <kbd>Ctrl</kbd><kbd>X</kbd> inserts extra blank line

# MarkdownParser
## Markdown Support
[Markdown Documentation](https://github.github.com/gfm/)

### Features
- code block syntax highlighting
- links and images
- link reference definitions
- hard line breaks
- entity and numeric character references
- setext heading
