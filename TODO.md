# Editor
## Bugs
- programmatically setting the selection doesn't scroll into view
- keydown event not fired on backspace in chrome on android, see [this](https://github.com/codemirror/view/blob/main/src/input.ts#L898) and [this](https://github.com/codemirror/view/blob/main/src/domobserver.ts#L296)

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
