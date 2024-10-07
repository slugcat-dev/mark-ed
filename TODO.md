# Editor
## Features
- selectionchange event
	- enter doesnt trigger selectionchange
- history
	- diffing
	- debounce

## Bugs
- programmatically setting the selection doesn't scroll into view

## Browser Quirks
- safari, ios: checkboxes are not clickable
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
- atx headings: closing mark
- fenced code blocks: syntax highlighting

### Not Implemented Yet
- links and images
- link reference definitions
- hard line breaks
- entity and numeric character references

### Won't Implement For Now
- tables
- setext headings
- fenced code blocks with `~~~`
- indented code blocks

### Won't Implement
- html
- nested blocks
- lazyness

# Documentation
- styling
- guides
	- scrollable wrapper
- custom keybinds
- custom markdown rules
- block hide rules
- proper api documentation
