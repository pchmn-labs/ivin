# The server's modules import each other in one order

The server's modules imported each other both ways: session and worktree, project and tab, transcript and tab, and six more pairs. A change to one module of a pair could break the other, and no module could be read or tested without the modules above it.

Each module imports only the modules below it, in this order, lowest first:

1. log, setting, keybinding, plugin
2. skill, cli
3. project
4. worktree
5. transcript
6. annotation
7. session
8. tab
9. file, server

Modules on the same line import none of each other.

A module that needs something from a module above it declares a port, and the module above provides its Layer: `SessionTabs`, declared in session, and `ProjectTabs`, declared in project, have their Layers in `tab/usecases/`. Code that serves a lower module but needs a higher one lives in the higher one: the removal of merged worktrees reads sessions and their runs, so it is in session.

## Considered options

- **Checking the order in CI**: left for later. Until then, a `tsort` of the imports between modules shows a cycle, and a review checks the order.
- **Ports for every import across modules**: rejected because most imports already go one way, and a port only earns its place where it breaks a cycle.

## Consequences

- A stateful Layer that serves use cases (a feed, a lock, the runs of all sessions) lives in `usecases/`, beside the port it implements; `adapters/` keeps the Layers that need the real outside.
- An adapter may read another module's tables when the port it implements asks about them: `AnnotationStore` answers whether a session or a project exists.
- `rpc/handlers.ts` composes the Layers that need no configuration, and `main.ts` adds the configured ones (paths, the harness, the database).
