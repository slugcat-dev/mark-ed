# TODO
## Bugs
- quote line wrap

## Features
- history
- highlighting in markdown code blocks
- make links clicky bois aswell
- change event

## Browser Quirks
- chrome, android: keydown event not fired on backspace
	https://github.com/codemirror/view/blob/main/src/input.ts#L898
	https://github.com/codemirror/view/blob/main/src/domobserver.ts#L296
- safari, ios: checkbox no clicky

## Backlog
- custom cursor
- reconfigure

## Other
- `mergeDefaults` toggle for `EditorConfig`, currently need `delete defaultLineGrammar.ATXHeading`
- scrollIntoView

## Project
- default eslint
- default stylesheet
- blockHideRules doc

# Markdown Support
https://github.github.com/gfm/

- Entity and numeric character references
- Links
- Images
- Link reference definitions
- Tables
