# The file tree is headless-tree on TanStack Virtual

The host `Tree`, which the Files tab of the sidebar draws, is built on `@headless-tree/core` and `@headless-tree/react` for focus, selection and the structure of the rows, and on `@tanstack/react-virtual` for the rows in view. The library stays behind the host `Tree`, because plugins import nothing but `@ivin/plugin-api` and `react` ([ADR-0002](0002-design-system-on-base-ui-and-css-custom-properties.md)). The transcript stays on Virtuoso ([ADR-0006](0006-the-transcript-stays-on-virtuoso.md)).

The library's own hotkeys are left out. Each key of the tree is a command bound in the `tree` area, which calls the library's methods, so the user can rebind it ([ADR-0003](0003-keyboard-shortcuts-are-keybindings-to-commands.md)). Typing a name to jump to a row stays in the tree, as a letter is not a keybinding.

Two candidates were tried in a spike each, against the `Tree` written on Virtuoso for #121:

| Criterion | `Tree` on Virtuoso (#121) | `@headless-tree/react` 1.8 on TanStack Virtual 3.14 | `@pierre/trees` 1.0 |
|---|---|---|---|
| Multi-selection, rename in place, drag and drop into a folder, copy and paste | none | multi-selection, rename and drag and drop built in; copy and paste is ours: a list of copied ids and a paste call, about ten lines | multi-selection, rename and drag and drop built in; no copy and paste |
| VS Code's explorer keys, remapped through ivin's keybindings | arrows, Home and End, fixed in the component | every key, each a command calling the library: its hotkeys are a feature left out of the list. Type-ahead is ours, about fifteen lines | no Page Up, Page Down, type-ahead or collapse all; the keys are fixed in its view and only a capturing listener on its element stops them |
| Folders listed one level at a time | yes, by the plugin | yes, from the plugin's rows, or with its async loader | yes, with code of ours that adds the children once a folder opens |
| 5,000 rows scrolled, headless Chromium, production build | 60 fps | 60 fps (three runs) | 60 fps (three runs) |
| ARIA tree roles, and visible focus | yes | yes: `tree`, `treeitem`, levels, `aria-selected`, `aria-multiselectable`; the ring is our stylesheet's | yes, reached by Playwright through its shadow root; no focus ring of its own |
| `--iv-` tokens, no inline style | yes | yes; the room above and under the rows in view is set as two custom properties, as `resize-handle` does | no: rows render in a shadow root that our classes cannot reach, only its `--trees-*-override` variables, and it sets inline styles itself |
| A plugin gives each row its icon | no | yes: a row is React, so a function can return its icon | no: an SVG sprite matched by name or extension, no React node |
| One React instance, bundle added (minified / gzipped) | already there | one React; +52.6 KB / +15.3 KB | one React, plus Preact 11 beta as a second renderer; +246.8 KB / +69.8 KB |

## Considered options

- **`@pierre/trees`**: rejected for the second renderer and its size, the styling that ignores our stylesheets, the fixed keys and the icons that cannot be React. The spike's code is on the `spike/146-pierre-trees` branch.
- **Keeping the `Tree` on Virtuoso**: rejected because selection, rename, drag and drop would all be ours to write. The headless-tree spike is on `spike/146-headless-tree`.

## Consequences

- The plugin still hands the `Tree` its rows and owns which folders are open, so `file.listFolder` and its states stay in the `files` plugin. The `Tree` keeps the focus and the selection.
- A `fileIcons` contribution needs nothing more from the library: the `Tree` draws each row's icon from one function, which a contribution's function can replace. It comes with the first plugin that gives icons.
- The anchor a Shift move extends the selection from is set through `getDataRef()`, which the library marks internal. An upgrade of headless-tree checks it still holds.
