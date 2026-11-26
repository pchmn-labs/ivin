# Code layout: `plugins/<id>`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
plugins/<id>/
  package.json          the manifest under its `ivin` key
  README.md             what it does, for the next agent that edits it
  src/
    server.ts           optional: the server half, activate(ctx)
    ui.tsx              optional: the UI half's entry, activate(ctx) only
    ui/<name>.tsx       optional: one component per file; a heavy one is loaded with import()
    hooks/use-<name>.ts optional: one hook per file, use- in the filename and in every export
    rules/              optional: the plugin's pure logic, read by both halves
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no `ctx`, no mock and no `await` |
| `hooks/` | a test needs a mounted component |
| `ui/` | a test needs a renderer |
| `server.ts`, `ui.tsx` | a test needs a `ctx` |

## Keeping `ui.tsx` small

`ui.tsx` loads when the window starts. It holds `activate` and what the first screen needs, such as a badge. A panel, an overlay or a theme goes in another file, which a slot component loads with `React.lazy(() => import("./ui/panel.tsx"))`; the host wraps each slot in a `Suspense` that shows its loading indicator, and a failed load shows the slot's failure. A `window.overlay` slot shows nothing while loading, so a plugin whose popup opens on a command mounts the lazy component at its first opening. The server bundles a user plugin with code splitting, so the same `import()` works there.

## Tests

The halves are tested with a fake `ctx`.

## Failures the host contains

An editor extension that CodeMirror rejects when the host builds an editor state with it, and a file icon function that throws, are turned off and reported in `ivin plugin logs <id>`; the rest of the plugin keeps working. A slot component that throws while rendering is reported there too.

## The plugin API

Reasons: [ADR-0014](../adr/0014-the-plugin-api-declares-its-own-types-and-one-hook-per-piece-of-data.md).

- A piece of data has one hook in `@ivin/plugin-api/ui`, with a parameter for its variant (`useChanges(sessionId, "committed")`), never a second hook per variant. Acts stay separate hooks.
- A hook that reads one item of a larger feed returns that item, so its component re-renders only when the item changes.
- A type that describes the server's data (a session, a change, a transcript item…) and that a hook, a slot prop or a `UiContext` member exposes is declared in `packages/plugin-api/src/types.ts`, never re-exported from `@ivin/contracts`.
