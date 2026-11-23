# Code layout: `plugins/<id>`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
plugins/<id>/
  package.json          the manifest under its `ivin` key
  README.md             what it does, for the next agent that edits it
  src/
    server.ts           optional: the server half, activate(ctx)
    ui.tsx              optional: the UI half, activate(ctx)
    rules/              optional: the plugin's pure logic, read by both halves
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no `ctx`, no mock and no `await` |
| `server.ts`, `ui.tsx` | a test needs a `ctx` |

## Tests

- `rules/`: called directly.
- The halves: with a fake `ctx`.

## Failures the host contains

An editor extension that CodeMirror rejects when the host builds an editor state with it, and a file icon function that throws, are turned off and reported in `ivin plugin logs <id>`; the rest of the plugin keeps working. A slot component that throws while rendering is reported there too.
