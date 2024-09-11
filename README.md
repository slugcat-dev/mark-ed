# mark-ed
**`mark-ed`** is a lightweight (zero-dependency) in-browser editor that supports Markdown formatting.

**[DEMO](https://doublekekse.dev/mark-ed)**

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

You can then access the content of the editor with `editor.content` and add event listeners to `editor.root`.

_The code for the demo is in the [`dev`](https://github.com/slugcat-dev/mark-ed/tree/main/dev) directory of this repository._


### Recommended attributes for the editor element
```ini
role="textbox"
aria-multiline="true"
spellcheck="false"
autocorrect="off"
autocapitalize="off"
```

You can adjust these as you need.

## Styling
Note that you need to properly style the editor if you want it to look good. CSS classes are prefixed with `md-`. Take a look at [`dev/style.css`](https://github.com/slugcat-dev/mark-ed/blob/main/dev/style.css) for an basic example.

## Development
To make development easier, this project comes with a live server to instantly view your changes. Install the needed development dependencies, then start the development server and open http://localhost:8000/ in your browser.

```sh
# Install dependencies
npm install

# Start dev server
npm run dev
```

# Thanks to these Projects
https://github.com/jefago/tiny-markdown-editor\
https://github.com/lezer-parser/markdown
