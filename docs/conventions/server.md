# Code layout: `apps/server`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
apps/server/src/
  rpc/                  the entry point: one handler per RPC, which runs a use case with its Layers
  modules/<subject>/
    rules/              pure and synchronous
    usecases/           Effect programs, one file per intention, and the ports they declare
    adapters/           the Layers behind those ports: SQLite, child processes, file watchers, sockets
  shared/               ids, errors, what every subject reads
  main.ts               the one file that builds every Layer
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no Layer and no `await` |
| `usecases/` | a test runs it with test Layers only |
| `adapters/` | a test needs the real database, process, file or socket |

- A use case takes its parameters first and its dependencies as services, and declares the port (an Effect service tag) it needs beside it in `usecases/`.
- Time comes in as a parameter or through `Clock`, so a rule never reads the clock.

## Tests

- `rules/`: called directly.
- Everything else: through the `rpc/` handlers, with an in-memory SQLite and the scripted `HarnessProvider` from `@ivin/harness`. No test spawns a real agent.
- A test file that spawns real processes (`git`) sets its own timeout with `vi.setConfig({ testTimeout })`, from its slowest test's duration with room for the parallel suite. The global 1000ms default stays, so a slow test elsewhere still fails.
