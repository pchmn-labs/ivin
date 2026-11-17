# Code is grouped by domain subject first, and what a test needs decides its layer

A package with logic puts its code in `modules/<subject>/`, one folder per thing the domain model names, and splits each module into layers by what a test of a file needs: nothing (`rules/`), test Layers or a fake client (`usecases/`, `atoms/`), a mounted component (`hooks/`), a renderer (`ui/`), the real outside (`adapters/`). Everything about a subject is then read in one folder, by a person or an agent, and the code that holds the decisions can be tested without a mock, because a file that would need one is split until it does not.

Only the edges that keep that true are enforced by the linter: pure code imports nothing impure, and orchestration (`usecases/`, `atoms/`) imports no adapter, so its I/O goes through a port or a service a test can replace. `effect/Schema` is the one Effect module pure code imports: a decode is synchronous and needs no Layer, and a test of the harness reads recorded provider lines through it. Every other import direction is left to the convention, because a rule the linter cannot check is cheaper to state than to fake.

A subject keeps one name in every package that handles it, and one name follows an intention from the server to the UI and the CLI, so a search for it finds every piece.

## Considered options

- **Layers first** (`src/usecases/`, `src/adapters/`, …, each with a folder per subject): rejected because reading one subject means opening every layer.
- **UI atoms in `hooks/` or `adapters/`**: rejected because an atom fed by an RPC stream needs neither a mounted component nor the real server; it runs in an atom registry with a fake RPC client, which is the test of an orchestration layer, so it gets its own, `atoms/`.
- **Barrel files** (`index.ts` re-exporting a folder): rejected because an import that names its file shows where the code is and avoids import cycles. A package's entry file, the one its `package.json` `exports` points to, is not a barrel: it is the package's public API.

## Consequences

- A package too thin to have layers stays flat, and a layer with nothing in it is not created.
- A module that outgrows its folders splits into `submodules/`, so a path still says which layer belongs to which module.
