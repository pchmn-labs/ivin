# Code layout: `packages/harness`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
packages/harness/src/
  index.ts              the entry point: the HarnessProvider port and one Layer per provider
  modules/<provider>/   claude, codex, acp, scripted
    rules/              provider output line → transcript events
    adapters/           the process and its stdio
  shared/               HarnessProvider, HarnessError, what every provider reads
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test feeds it recorded provider lines and reads events, with no process |
| `adapters/` | a test needs the real agent process |

- A module is a provider, named by its `HarnessProvider` id.
- `scripted` replays a recorded transcript through the same port; the server's tests use it in place of a real provider.

## Tests

- `rules/`: on recorded provider output kept as fixtures in `modules/<provider>/fixtures/`.
