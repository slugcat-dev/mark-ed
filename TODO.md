# EditorConfig
new Editor(root, config)

- tab size
- initial content

# Other
- ctrl + c
- Setup demo page
- wrap selection
- Keymap handler
- DOM diffing
- deployment / installation section in readme
- proper markdown parsing
- readonly
- Hosted version: https://unpkg.com/@slugcat-dev/mark-ed@latest

- https://github.com/markedjs/marked/blob/master/src/Renderer.ts

- https://codemirror.net/docs/guide/
- https://github.com/codemirror/state/blob/main/src/state.ts
- https://github.com/codemirror/view/blob/main/src/editorview.ts
- https://github.com/codemirror/commands/blob/main/src/history.ts

- https://github.com/Wilfred/difftastic/wiki/Line-Based-Diffs

# Markdown
Included:
- ATX Headings
- Fenced code blocks
- Block quotes
- Lists
- Task list items
- Backslash escapes
- Code spans
- Emphasis and strong emphasis
- Strikethrough
- Underline
- Autolinks
- Highlight

Not included:
- HTML blocks
- Entity and numeric character references

Optional:
- Thematic break
- ATX heading mode
- Setext heading
- Fenced code block mode
- Links
- Images
- Emoji

Probably not included:
- Indented code blocks
- Link reference definitions
- Tables


2 Preliminaries
 	2.1 Characters and lines
 	2.2 Tabs
 	2.3 Insecure characters
4 Leaf blocks
 	  4.1 Thematic breaks
 	  4.2 ATX headings
 	  4.3 Setext headings
 	  4.4 Indented code blocks
 	  4.5 Fenced code blocks
 	  4.6 HTML blocks
 	  4.7 Link reference definitions
 	  4.8 Paragraphs
 	  4.9 Blank lines
 	  4.10 Tables (extension)
5 Container blocks
 	5.1 Block quotes
 	5.2 List items
 	5.3 Task list items (extension)
 	5.4 Lists
6 Inlines
 	  6.1 Backslash escapes
 	  6.2 Entity and numeric character references
 	  6.3 Code spans
 	  6.4 Emphasis and strong emphasis
 	  6.5 Strikethrough (extension)
 	  6.6 Links
 	  6.7 Images
 	  6.8 Autolinks
 	  6.9 Autolinks (extension)
 	  6.10 Raw HTML
 	  6.11 Disallowed Raw HTML (extension)
 	  6.12 Hard line breaks
 	  6.13 Soft line breaks
 	  6.14 Textual content
