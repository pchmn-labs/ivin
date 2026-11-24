# Code layout: `apps/server`

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md). Rules shared with every package: [README](README.md).

```
apps/server/src/
  rpc/                  the entry point: one handler per RPC, which runs a use case with its Layers;
                        `handlers.ts` composes the Layers that need no configuration
  modules/<subject>/
    rules/              pure and synchronous
    usecases/           Effect programs, one file per intention, the ports they declare,
                        and the stateful Layers that need no outside: feeds, locks, runs
    adapters/           the Layers that reach the outside: SQLite, child processes, file watchers, sockets
  shared/               ids, errors, what every subject reads
  main.ts               adds the configured Layers (paths, the harness, the database) and starts the server
```

| Layer | Test of membership |
|---|---|
| `rules/` | a test calls it with no Layer and no `await` |
| `usecases/` | a test runs it with test Layers only |
| `adapters/` | a test needs the real database, process, file or socket |

- A use case takes its parameters first and its dependencies as services, and declares the port (an Effect service tag) it needs beside it in `usecases/`.
- Time comes in as a parameter or through `Clock`, so a rule never reads the clock.

## Module order

Reasons: [ADR-0012](../adr/0012-server-modules-import-each-other-in-one-order.md). A module imports only the modules below it, lowest first:

1. log, setting, keybinding, plugin
2. skill, cli
3. project
4. worktree
5. transcript
6. annotation
7. session
8. tab
9. file, server

Modules on the same line import none of each other. A module that needs one above it declares a port in its `usecases/`, and the module above provides its Layer, as `tab` does for `SessionTabs` and `ProjectTabs`.

## Tests

- `rules/`: called directly.
- Everything else: through the `rpc/` handlers, with an in-memory SQLite and the scripted `HarnessProvider` from `@ivin/harness`. No test spawns a real agent.
- A test file that spawns real processes (`git`) sets its own timeout with `vi.setConfig({ testTimeout })`, of about ten times its slowest test's duration when run alone, since the parallel suite slows it down. The global default stays, so a slow test elsewhere still fails.
