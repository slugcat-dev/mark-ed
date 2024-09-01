# mark-ed
**mark-ed** is a lightweight (zero-dependency) in-browser editor that supports Markdown formatting.

**[DEMO]**

> [!NOTE]
> This project is in early development and I'm currently working on it.\
> Expect breaking changes.

Note that it does not implement the full [CommonMark](https://commonmark.org/) or [GFM](https://github.github.com/gfm/) spec. If you search for a proper **Markdown** editor, you may like to try these alternatives:
- **[CodeMirror](https://codemirror.net/)** - A complete code and text editor. With some tweaking, it can become a great Markdown editor too
- **[TinyMDE](https://github.com/jefago/tiny-markdown-editor)** - Another in-browser Markdown editor

## Usage
You can then create your own editor like this:

```html
<div id="editor"></div>
```

```ts
import { Editor } from 'mark-ed'

// Create the Editor instance
const editor = new Editor('editor')
```

You can then access the content of the editor with `editor.content` and add event listeners to `editor.root`, like in this example:

```ts
// Set the content of the editor
editor.content = '# Hello, World!'

// After the user is done editing, log the new content to the console
editor.root.addEventListener('blur', () => {
  console.log('Editor content:')
  console.log(editor.content)
})
```

## Development
To make development easier, this project comes with a live server to instantly view your changes. Install the needed development dependencies, then start the development server and open http://localhost:8000/ in your browser.

```sh
# Install dependencies
npm install

# Start dev server
npm run dev
```
