# mark-ed

![demo.gif](https://github.com/user-attachments/assets/3dc49cfc-9e57-482c-b06f-787269aa5a95)

**`mark-ed`** is a lightweight (zero-dependency, less than 60 kB) in-browser editor that supports Markdown formatting, implemented in TypeScript.

### [DEMO](https://doublekekse.dev/mark-ed) • [DOCS](https://github.com/slugcat-dev/mark-ed/wiki)

## Features
- **Rich Editing:** Seemless in-editor formatting makes editing more immersive than having a split view between editor and preview, like most Markdown editors have.

- **Minimal Distractions:** Markdown syntax can be automatically hidden where you don't edit to reduce the visual noise, like in Obsidian.

- **Easy to Use:** Embed the editor on your website with only three lines of code!

- **Highly Customizable:** Extend the editor with your own parsing rules and keybinds, and style it to match your design.

## Basic Usage
For a more detailed explanation on how to install and use the editor, see [**Getting Started**](https://github.com/slugcat-dev/mark-ed/wiki/Getting-Started).

```html
<div id="editor"></div>
```

```ts
import { Editor } from '@slugcat-dev/mark-ed'

const editor = new Editor('editor')
```

## Issues
An editor like this is a piece of software that has to cover a lot of edge cases. If you encounter any unexpected behaviour, please [open an issue](https://github.com/slugcat-dev/mark-ed/issues), and I will do my best to fix it as soon as possible.

## Contributing
To make development easier, this project comes with a live server to instantly view your changes. Install the needed development dependencies, then start the development server and open http://localhost:8000/ in your browser.

```sh
# Install dependencies
npm install

# Start dev server
npm run dev
```

## Thanks to these Projects
https://github.com/jefago/tiny-markdown-editor/ \
https://github.com/codemirror/ \
https://github.com/lezer-parser/markdown/
