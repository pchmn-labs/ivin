# Code layout: `packages/ui`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
packages/ui/src/
  app/                  the entry point: window shell, layout, slot renderer; composes the modules' ui/
  modules/<subject>/
    rules/              pure: no React, atom, RPC client or adapter
    atoms/              the subject's atoms, fed by RPC streams, and one Atom.fn per RPC mutation
    hooks/              what needs a mounted component: use- in the filename and in every export
    adapters/           browser APIs and stores outside the RPC: clipboard, local storage, drag and drop
    ui/                 components
  core/
    components/<name>/  design system: <name>.tsx, <name>.css, its test
    theme/              the --iv- tokens and base styles
    server-client.ts    the RPC client service
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no mock and no `await` |
| `atoms/` | a test reads it in an atom registry with a fake RPC client, no component mounted |
| `hooks/` | a test needs a mounted component |
| `adapters/` | a test needs the real browser API |
| `ui/` | a test needs a renderer |

- An atom reaches the server through the RPC client service in `core/`, never through `adapters/`.
- A mutation atom is named for the server use case it calls: `atoms/rename-session.ts` for `usecases/rename-session.ts`.
- A module has the server's name for the subject.
- A file that needs a mock to reach one of its functions holds two layers: split it.

## Styles

- A component's styles live in a `.css` file beside it, with `iv-` classes and `--iv-` tokens only; no inline `style`. A screen in `modules/<subject>/ui/` does the same. The exceptions set a measured size as a custom property for a stylesheet to read: `core/components/resize-handle` (the size the user dragged, on its parent), `core/components/tree` (the room above and under the rows in view).
- A `var()` reads a `--iv-` token, or a variable the component library sets on its popups: `--available-height`, `--available-width`, `--transform-origin`, and the `--toast-*` ones of the notification stack.
- `modules/` and `app/` use the `core/components` controls, not a native `<button>`, `<input>`, `<select>` or `<textarea>`. The exceptions are the files whose controls no core component draws yet (the tabs, the project rail, the composer's triggers, the image thumbnails…), listed in the `.oxlintrc.json` override that turns `react/forbid-elements` off.

## Colour

Every colour is a `--iv-` token, or `color-mix()` on one, with two exceptions: a harness mark keeps its brand colour (in `core/components/harness-mark/harness-mark.css`), and an icon from a file icon theme (a `fileIcons` contribution, such as the `file-icons` plugin's) keeps its own colours.

## Checked by `pnpm lint`

The rules of Styles and Colour fail `pnpm lint` in `packages/ui/src`, test files left out: Stylelint checks the CSS (`.stylelintrc.json`), Oxlint the TSX (`.oxlintrc.json`), and `tools/lint-rules/ui-styles.test.ts` tests both. An exception goes in the config and its test, not only in this file.

## Tests

- `rules/`: called directly.
- `atoms/`: in an atom registry, with a fake RPC client.
- `hooks/` and `ui/`: Vitest browser mode, with the same fake RPC client.
- `*.perf.test.tsx`: the same, on the build the app ships (production React and the React Compiler, `vitest.perf.config.ts`), failing below a frame rate. They run one file at a time, after every other test.
- A browser test that fails saves a capture of the page in `.vitest/attachments/failure-screenshots/<test file>/<test name>.png`, at the root of the checkout or worktree, not in `packages/ui/`.
