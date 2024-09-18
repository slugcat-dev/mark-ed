# mark-ed

![demo.gif](https://github.com/user-attachments/assets/3dc49cfc-9e57-482c-b06f-787269aa5a95)

**`mark-ed`** is a lightweight (zero-dependency, less than 50 kB) in-browser editor that supports Markdown formatting, implemented in TypeScript.

**[DEMO](https://doublekekse.dev/mark-ed) • [DOCS](https://github.com/slugcat-dev/mark-ed/wiki)**

## Features
- **Rich Editing:** Seemless in-editor formatting makes editing more immersive than having a split view between editor and preview, like most Markdown editors have.

- **Minimal Distractions:** Markdown syntax is automatically hidden where you don't edit to reduce the visual noise, like in Obsidian.

- **Easy to Use:** Embed the editor on your website with only three lines of code!

- **Highly Customizable:** Extend the editor with your own parsing rules and keybinds, and style it to match your design.

## Installation
Install the package from npm:

```sh
npm install @slugcat-dev/mark-ed
```

## Usage
You can then create your own editor like this:

```html
<div id="editor"></div>
```

```ts
import { Editor } from '@slugcat-dev/mark-ed'

// Create the Editor instance
const editor = new Editor('editor')
```

Access the content of the editor with `editor.content` and add event listeners to `editor.root`. Refer to the documentation for additional information. You can also take a look at the code for the demo in the [`dev`](https://github.com/slugcat-dev/mark-ed/tree/main/dev) directory.

If you need a hosted version instead, you can use unpkg:

```ts
import { Editor } from 'https://unpkg.com/@slugcat-dev/mark-ed@latest'
```

## Styling
Note that you need to properly style the editor if you want it to look good. CSS classes are prefixed with `md-`. Take a look at the [`style.css`](https://github.com/slugcat-dev/mark-ed/blob/main/dev/style.css) from the demo for a basic example.

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
