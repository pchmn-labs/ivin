# Code layout: `plugins/<id>`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

Built-in plugins have the same format as user plugins, so each one is a worked example of the plugin API.

```
plugins/<id>/
  plugin.json
  server.ts             optional: the server half, activate(ctx)
  ui.tsx                optional: the UI half, activate(ctx)
  rules/                optional: the plugin's pure logic, read by both halves
  README.md             what it does, for the next agent that edits it
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no `ctx`, no mock and no `await` |
| `server.ts`, `ui.tsx` | a test needs a `ctx` |

- A plugin imports `@ivin/plugin-api` and `react` only, and its own files.

## Tests

- `rules/`: called directly.
- The halves: with a fake `ctx`.
