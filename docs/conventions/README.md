# Code layout: rules every package follows

Reasons: [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md).

Per package: [server](server.md), [harness](harness.md), [ui](ui.md), [plugins](plugins.md). The packages below have no layers and follow this file only.

## Modules

`src/modules/<subject>/`, one folder per term of the domain model, in the singular: `session`, `transcript`, `annotation`, `project`, `plugin`, `worktree`. A module is a thing; an act on it (sending, archiving) is a file inside it, and a feature (session PRs, the approval sheet) is a plugin. A subject has the same name in every package that handles it.

What belongs to no subject goes in `src/shared/`.

## Layers

| Layer | A file belongs here if a test of it… | In |
|---|---|---|
| `rules/` | calls it directly: no mock, no Layer, no `await` | every package with logic |
| `usecases/` | runs it with test Layers: no real process, file or database | server |
| `atoms/` | runs it in an atom registry with a fake RPC client, no component mounted | ui |
| `hooks/` | needs a mounted component | ui |
| `ui/` | needs a renderer | ui |
| `adapters/` | needs the real database, a process, a file, a socket or a browser API | server, harness, ui |

A layer exists only when it holds a file. Create a folder with its first file.

## Enforced imports

Checked by Oxlint once the milestone-1 skeleton adds it, as `no-restricted-imports` overrides in `.oxlintrc.json` whose message cites ADR-0001:

- Files under `**/rules/**` import none of `effect` and its submodules except `effect/Schema`, `node:*`, `electron`, `react`, nor any `adapters/`, `usecases/`, `atoms/`, `hooks/` or `ui/`. Types from `contracts` come in through `import type`.
- Files under `**/usecases/**` and `**/atoms/**` import none of `node:*`, `electron`, nor any `adapters/`.
- Files under `**/atoms/**` import none of `react`, nor any `hooks/` or `ui/`.
- Files under `plugins/**` import no package but `@ivin/plugin-api` and `react`.

Between workspaces, a package imports only what its `package.json` declares, and nothing declares an app.

Every other direction is a convention nothing checks: `ui/` reads `hooks/` and `atoms/`, `hooks/` read `atoms/`, modules import each other freely.

## Files

- kebab-case.
- One name follows an intention through the code: `session/usecases/send-message.ts`, the `session.sendMessage` RPC, `session/atoms/send-message.ts`, `ivin session send`.
- No barrel: an import names its file. The file a package's `package.json` `exports` points to is the only one that re-exports.
- A module that outgrows its folders splits into `modules/<subject>/submodules/<part>/`, each with its own layers, never a second `modules/`.

## Tests

Beside the file they test, as `<file>.test.ts`. `rules/` are called directly; each package's file says how the other layers are tested.

## Flat packages

No modules and no layers; one file per concern, kebab-case.

| Package | Holds |
|---|---|
| `apps/desktop` | Electron main and preload, packaging |
| `apps/plugin-host` | the plugin host process: loads server halves, implements `ctx` over RPC |
| `apps/cli` | the `ivin` binary, one file per command |
| `packages/contracts` | Effect `Schema` only, one file per subject |
| `packages/state` | atom families, optimistic writes, stream bridging |
| `packages/plugin-api` | entry points `server.ts` and `ui.ts`: types and runtime shims |

A flat package that grows logic of its own takes `src/modules/` and the layers above.
