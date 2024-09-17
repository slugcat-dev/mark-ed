# mark-ed

![](demo.gif)

**`mark-ed`** is a lightweight (zero-dependency) in-browser editor that supports Markdown formatting.

**[DEMO](https://doublekekse.dev/mark-ed) • [DOCS](https://github.com/slugcat-dev/mark-ed/wiki)**

## Features
- **Rich Editing:** Seemless in-editor formatting makes editing more immersive than having a split view between editor and preview, like most Markdown editors have.

- **Minimal Distractions:** Markdown syntax is automatically hidden where you don't edit to reduce the visual noise, just like in Obsidian.

- **Easy to Use:** Embed the editor on your website with only three lines of code!

- **Highly Customizable:** Extend the editor with your own parsing rules and keybinds, and style it to match your design.

## Installation
Install the package from npm:

```sh
npm install @slugcat-dev/mark-ed
```

If you need a hosted version instead, you can use unpkg:

```ts
import { Editor } from 'https://unpkg.com/@slugcat-dev/mark-ed@latest'
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

Access the content of the editor with `editor.content` and add event listeners to `editor.root`.

_The code for the demo is in the [`dev`](https://github.com/slugcat-dev/mark-ed/tree/main/dev) directory of this repository._

## Thanks to these Projects
https://github.com/jefago/tiny-markdown-editor/ \
https://github.com/codemirror/ \
https://github.com/lezer-parser/markdown/
