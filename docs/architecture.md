# ivin — architecture

ivin is a desktop app to run and supervise coding agents (Claude Code, Codex, ACP agents), built so that **the user's agents can change it**: through files and a CLI for anything declarative, and through TypeScript plugins for anything else.

It replaces a fork of MonoCode that grew to 167 commits, 54 features and 142 touched upstream files, where every feature was first shaped by the cost of the next upstream merge. ivin starts from what that fork taught: which extension points a real feature set needs (see [Porting the fork](#porting-the-monocode-fork)).

## Principles

1. **Everything is a plugin, including our own features.** Built-in features use the public plugin API. If one can't, the API is missing something; fix the API, not the feature. The API stays free to break until the fork is replaced (see [API stability](#api-stability)): it is shaped by porting real features, not designed ahead of them.
2. **Files and a CLI before tools.** Settings, themes, keybindings and session annotations live in watched files and are reachable through the `ivin` CLI. Agents already master files and shells, on every harness, with no injection. MCP comes later, only as an optimisation.
3. **A broken plugin must not take the app down, and the app always recovers.** Agents write most plugins. Server halves run in their own process, which can be killed without touching running sessions; UI errors are contained to the plugin's slot where React allows it, and safe mode covers the rest. Errors are reported where the agent can read them.
4. **Don't reinvent the harness layer.** Provider protocols come from T3 Code and MonoCode (both MIT, attribution kept in `NOTICE`).
5. **Light and leak-free by default.** Every feature is measured against a memory and startup budget (see [Performance and memory](#performance-and-memory)).
6. **Effect inside, plain TypeScript at the edge.** The core is written with Effect v4; the plugin API is functions, promises and React hooks.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron | Node in the backend, so plugins have a backend half in TS; one Chromium everywhere; most mature desktop runtime |
| UI | React + TypeScript | What agents write best; plugin UI is just React components |
| UI state | Effect `Atom` (`effect/reactivity`) + `@effect/atom-react` | One model from server to screen: RPC streams feed atoms, components read atoms |
| Core | Effect v4 (stable since 2026-09-30) | Long-lived processes, streams, cancellation and scoped resources are the harness layer's daily work |
| Contracts | Effect `Schema` | One definition for RPC payloads, persisted data and transcript parsing |
| Storage | SQLite (`node:sqlite`) | Sessions, transcript events, plugin storage; files stay files. No native module to rebuild; checked in a `utilityProcess` on Electron 45 (WAL, JSON operators, FTS5) |
| Plugin build | Rolldown (Oxc transform), in process | Plugins are `.ts` sources compiled on load; no build step for the author. Same bundler as Vite, so app and plugins resolve and transform code the same way |
| Toolchain | VoidZero stack, through Vite+ (`vp`) | One CLI and one parser (Oxc) for dev server, build, tests, lint and format |
| Monorepo | pnpm workspaces, `vp` task runner | |

### Toolchain

All build and quality tools come from the VoidZero open-source stack (MIT):

| Tool | Used for |
|---|---|
| Vite (Rolldown-based) | renderer dev server with HMR, renderer build |
| tsdown | `main`, `preload`, `server`, `cli` and the publishable packages (`contracts`, `plugin-api`) |
| Rolldown | plugin compilation at runtime (its JS API, with host modules as externals) |
| Vitest | unit and component tests; Vitest browser mode for UI tests |
| Oxlint | lint, with type-aware rules; it also enforces the import rules of the [code layout](#code-layout) |
| Oxfmt | format |
| Vite+ (`vp`) | single entry point for the above, cached monorepo tasks, Node and pnpm versions |

Vite+ is still in beta: the repo keeps a plain config per tool, so dropping `vp` for direct tool calls stays a script change. `vp lint` and `vp fmt` are passed their config with `-c` (`.oxlintrc.json`, `.oxfmtrc.json`), because `vp` only reads such options from `vite.config.ts`; `vp check` has no `-c` and is not used. Each package that bundles keeps its options in `tsdown.config.ts`, and its `vite.config.ts` imports them as `pack`. Build, dev and type-check tasks run through `vp run`. Electron packaging (electron-builder) and end-to-end tests (Playwright driving Electron) are outside this stack.

GPUI (or any native Rust UI) was considered and rejected: UI plugins in Rust mean WASM or dynamic libraries with no stable ABI, and Zed itself can't offer UI extensions on it. Tauri was rejected because its backend is Rust, which would confine plugins to the webview.

Effect v4 is recent, so agents will often write v3 idioms in the core. That cost is accepted and kept away from plugin authors by principle 6; the core's `AGENTS.md` must point at the v4 docs and at in-repo examples.

## Processes

```
┌────────────── Electron main ──────────────┐
│ windows, menus, native dialogs, updater   │
│ spawns ↓, brokers ports, safe mode        │
└───────┬───────────────────────┬───────────┘
        │ MessagePort (RPC)     │
┌───────▼────────────┐  ┌───────▼────────────────────────┐     ┌──────────────────────┐
│ renderer (React)   │  │ server (utilityProcess, Effect)│ RPC │ plugin host          │
│ UI + plugin UI     │◄─┤ sessions, harnesses, git, gh,  │◄───►│ (utilityProcess)     │
│ halves             │  │ store, file watchers, plugin   │     │ plugin server halves │
└────────────────────┘  │ build, CLI socket              │     └──────────────────────┘
                        └───────▲────────────────────────┘
                                │ unix socket
                        ┌───────┴────────┐
                        │ `ivin` CLI     │  ← agents, scripts, the user
                        └────────────────┘
```

- **server** runs in an Electron `utilityProcess`, so a slow git call never freezes the window, and the same server can later run headless (remote machine, web client, mobile) like T3 Code's. Agent processes are its children, so nothing a plugin does may run inside it.
- **plugin host** is a second `utilityProcess` that runs every plugin's server half. A plugin that loops or crashes takes the host down, not the server: sessions keep running, and the server restarts the host without the faulty plugin (see [Error isolation](#error-isolation)).
- **main** stays thin: windows, OS integration, and the crash bookkeeping behind safe mode.
- **One RPC contract, several transports.** `packages/contracts` defines every request and stream once with Effect `Schema`. The renderer reaches it over a `MessagePort`, the plugin host over another, the CLI over a unix socket (`~/.ivin/run/ivin.sock`, mode 0600), and a headless client later over a WebSocket. Every CLI command is an RPC the UI can call.

## Repository layout

```
apps/                 what runs: each has a `main` and is imported by nothing
  desktop/            Electron main + preload, packaging. Thin, flat
  server/src/
    rpc/              the public seam: one handler per RPC, a use case given its dependencies
    modules/<subject>/
      rules/          pure and synchronous
      usecases/       Effect programs, one file per intention, and the ports they need
      adapters/       Layers behind those ports: SQLite, child processes, file watchers, sockets
    shared/
    main.ts           composition root: the one place that knows every Layer
  plugin-host/        entry of the plugin host process: loads server halves, implements `ctx` over RPC. Flat
  cli/                `ivin` binary (thin RPC client). Flat, one file per command
packages/             what is imported
  contracts/          Schema only, one file per subject: RPC, domain types, transcript events, plugin manifest
  harness/src/
    index.ts          the HarnessProvider port and one Layer per provider
    modules/<provider>/   claude, codex, acp, scripted (replays a recorded transcript for tests)
      rules/          provider line → transcript events
      adapters/       the process and its stdio
    shared/
  ui/src/
    app/              window shell, layout, slot renderer
    modules/<subject>/
      rules/          pure
      atoms/          the subject's atoms fed by RPC streams, one Atom.fn per RPC mutation
      hooks/          what needs a mounted component
      adapters/       browser APIs and stores outside the RPC
      ui/
    core/             design system, theme, the RPC client service
  state/              atom families, optimistic writes, stream bridging (`@ivin/state`)
  plugin-api/         entry points `server.ts` and `ui.ts`: types + runtime shims (the only package plugins import)
tools/                repo tooling: `lint-rules/` tests the ADR-0001 import rules of `.oxlintrc.json`
plugins/<id>/         built-in plugins, same format as user plugins; `rules/` beside the two halves when one has logic
docs/
```

### Code layout

The subject comes before the layer: a package with logic has one module per term of the domain model, named the same in `contracts`, `server` and `ui`, and what a test of a file needs decides its layer (`rules/`, `usecases/`, `atoms/`, `hooks/`, `ui/`, `adapters/`). Oxlint enforces that pure code imports nothing impure and that orchestration imports no adapter; every other direction is navigation. Packages too thin to have layers (`desktop`, `cli`, `plugin-host`, `contracts`, `state`, `plugin-api`) stay flat.

The rules per package are in [`docs/conventions/`](conventions/README.md), the reasons in [ADR-0001](adr/0001-code-grouped-by-subject-and-layered-by-test.md).

Tests sit beside the file they test, at three levels:

- **Rules**, called directly. Harness parsing runs on recorded provider output kept as fixtures.
- **Server**, through the `rpc/` handlers, with an in-memory SQLite and a scripted `HarnessProvider` that replays a recorded transcript. No test spawns a real agent.
- **App**, a few Playwright runs on the same scripted provider.

## Domain model

- **Project**: a folder or a `.code-workspace` (several folders), with its settings.
- **Session**: one agent conversation, bound to a project folder, a cwd (checkout or worktree), a branch, a harness and a model. Owns a transcript.
- **Transcript**: an append-only list of normalised events (`user_message`, `assistant_text`, `thinking`, `tool_call`, `tool_result`, `approval_request`, `usage`, `status`…), each with a stable id, **owned by ivin**: every event is written to SQLite as it streams, never re-read from the provider's files. Provider-specific payloads are kept in a `raw` field so plugins can read what the normalisation drops; `raw` is outside the API contract and changes with the provider.
- **Transcript items**: the read model derived from the events, and what the UI and plugin hooks expose: a tool call merged with its result and status, a subagent with its nested items, streamed text assembled. Plugins render items; they don't re-derive them from events.
- **Annotation**: typed, namespaced metadata attached to a session (or project), written by plugins, the CLI or the agent. Example: `{ ns: "prs", kind: "pr", data: { url, relation: "created" } }`. This is the generic answer to "link these PRs to this session".
- **Tab / pane layout**: workspace tabs holding session, file and plugin views.

The server is the source of truth and persists to SQLite; the renderer holds a read model fed by RPC streams, in atoms that the plugin hooks wrap (see [UI state](#ui-state)). Plugin storage is a namespaced key-value store in the same database.

### Owning the transcript

- Codex and ACP have no equivalent of Claude's JSONL, and annotations and plugins need event ids that don't depend on a provider's file.
- Plugins, search and the UI read one store with one shape, whatever the harness, and ivin keeps events providers drop or rewrite (approvals, steering, interruptions, timings).
- Providers keep their own files for resuming: ivin stores the provider's session id (Claude `--resume`, Codex thread id, ACP session id) and resumes through it. ivin's copy is for display and plugins, never fed back to the agent.
- When the two diverge (a session resumed in a terminal, a Claude `/compact`), the provider's files win for the agent and ivin appends what it sees on the next run; an importer reads Claude and Codex files to backfill such gaps and to bring in sessions started outside ivin.

### UI state

The renderer is Effect end to end: each RPC stream from the server feeds an `Atom`, derived atoms compute views (sorted sessions, a session's PRs), and components read them with `@effect/atom-react` hooks (Suspense for async results). Plugin hooks (`useSession`, `useAnnotations`…) are thin wrappers over these atoms, and plugins may also define and read atoms of their own.

`effect/unstable/*` modules, reactivity included, can break in minor releases: pin Effect to an exact version and upgrade deliberately.

Why atoms rather than Zustand stores (T3 Code mixes both, Zustand for local UI state): one model for plugins to learn instead of two; server streams become atoms with no glue; per-entity atoms are released with their readers, where Zustand stores are global and live until cleaned by hand. The state layer sits behind `@ivin/state` (atom families, optimistic writes, stream bridging), so a swap would stay contained.

### Responsiveness

- **Normalised, fine-grained state.** A list atom holds ids; each session, message and tool call is its own atom in a family. Appending a message or streaming into one re-renders that row only.
- **Optimistic by default.** Sending, renaming, archiving or reordering updates the atom at once and reconciles with the server's answer; the server is local, so it rarely waits more than a frame.
- **Frame-batched streaming.** Token deltas are coalesced per animation frame before reaching atoms; finished Markdown blocks are memoised and only the open block is re-parsed.
- **Virtualised lists** for transcripts, sidebar and file trees; React Compiler for memoisation; transitions (`useTransition`, `useDeferredValue`) for heavy views such as diffs and search.
- **Perf tests** next to the leak test: stream a 10k-token answer and scroll a 2k-event transcript, failing below a frame-rate threshold.

Queries run in the server against SQLite and stream their results; the renderer never holds a client-side copy of whole collections. A client database such as TanStack DB (live queries over in-memory collections) would duplicate data the server already indexes and add a second reactive model next to atoms; reconsider only if cross-collection queries in the renderer become heavy.

## Performance and memory

Targets, checked in CI on every PR: idle memory of all processes, cold start to first paint, and heap growth after the leak scenario below.

- **Transcripts are paged, not loaded.** The renderer holds a window of events around the viewport (virtualised list) and asks the server for more; large tool outputs and images are stored as blobs and fetched when unfolded.
- **Atoms die with their readers.** No `keepAlive` by default; per-session atom families are released when no component reads them.
- **Everything long-lived is scoped.** Child processes, watchers, subscriptions and timers live in an Effect `Scope` (server) or in the plugin's `ctx` (plugins), closed with their session, tab or plugin.
- **Bounded streams.** Harness and RPC streams have bounded buffers with backpressure; a slow renderer drops to snapshots instead of queuing events.
- **Shared, paused polling.** Polling goes through one scheduler, `ctx.poll` for plugins: deduplicated per key and paused while the window is hidden. A plugin stops polling what can no longer change, such as a merged PR.
- **Lazy plugins.** A plugin's UI half is imported when one of its slots first renders; its server half when its first event or command fires, unless it declares `"activation": "startup"`.
- **One renderer.** No extra `BrowserWindow` or `WebContentsView` per tab; Vite code-splits views so unused ones are never parsed.
- **Leak test.** A Playwright scenario opens and closes 50 sessions, switches tabs and reloads a plugin 20 times, forces GC, and fails if heap or open handles grow past a threshold.

## Harness layer

Each provider implements one Effect service:

```ts
interface HarnessProvider {
  readonly id: "claude" | "codex" | "acp"
  readonly start: (input: StartInput) => Effect<HarnessRun, HarnessError, Scope>
}
interface HarnessRun {
  readonly events: Stream<TranscriptEvent, HarnessError>
  readonly send: (message: UserMessage) => Effect<void, HarnessError>
  readonly respond: (approval: ApprovalDecision) => Effect<void, HarnessError>
  readonly interrupt: Effect<void>
}
```

- Claude: `--output-format stream-json --input-format stream-json`, permission prompts over stdio. Codex: `app-server` JSON-RPC. ACP: one generic client for Cursor, Devin, Grok, Hermes and others.
- Reference implementations: T3 Code's provider layer and MonoCode's `src/integrations/harness`. Both are read before writing a provider, for the protocol details and edge cases they already solved (flags, message shapes, approval flow, resume, interrupts). Code is copied or adapted where it fits ivin's interfaces, with attribution; neither is a dependency, and nothing requires matching their structure or their Effect version.
- Every spawned agent gets `IVIN_SESSION_ID` and `IVIN_SOCKET` in its environment, so `ivin` commands run by the agent apply to its own session with no argument.
- Plugins can amend a spawn (`harness.beforeSpawn`: extra args, env, MCP servers, appended system prompt) and observe every event (`transcript.onEvent`).
- `transcript.onEvent` is an observer: events are forwarded to the plugin host after they are persisted, and a slow plugin only delays itself.
- `harness.beforeSpawn` is on the spawn's critical path, so its rules are explicit. Hooks run in plugin load order; each returns a patch that is merged (env and args append, a later plugin wins on the same env key). A hook that throws or exceeds 2 s is skipped, the spawn goes on, and the session shows a warning naming the plugin.

## Plugin system

### On disk

```
<plugins dir>/prs/
  plugin.json
  server.ts      optional, runs in the plugin host process
  ui.tsx         optional, runs in the renderer
  tsconfig.json  generated by `ivin plugin new`, resolves `@ivin/plugin-api` to the app's types
  README.md      what it does, for the next agent that edits it
```

```json
{
  "id": "prs",
  "name": "Session PRs",
  "version": "0.1.0",
  "apiVersion": 0,
  "server": "server.ts",
  "ui": "ui.tsx",
  "settings": { "foldThreshold": { "type": "number", "default": 2 } }
}
```

Plugin directories, loaded in this order (a later one with the same `id` overrides an earlier one):

1. built-in: `plugins/` in the app bundle;
2. user: `~/.ivin/plugins/`;
3. project: `<repo>/.ivin/plugins/` (gated by a trust prompt, see below).

### Project plugin trust

A project plugin lives inside the agent's working directory, so an agent allowed to edit files, or a `git pull`, could otherwise turn a file write into code execution outside the harness's permission system. Trust is therefore given to a **content hash** of the plugin directory, not to the repo: any change leaves the previous trusted version running and asks again, showing the diff. An agent iterating on a plugin without a prompt per edit works in `~/.ivin/plugins/`, which is outside its working directory and so behind the harness's own permission prompt.

### Loading

- The server compiles `server.ts` and `ui.tsx` with Rolldown on load (cached by content hash in `~/.ivin/cache/plugins`), and hands the server bundle to the plugin host.
- `react`, `react-dom` and `@ivin/plugin-api` are externals provided by the host (import map in the renderer, module aliases in the plugin host), so there is exactly one React instance.
- Each half exports `activate(ctx)`; everything it registers through `ctx` is disposed automatically on deactivate. `ctx.signal` (an `AbortSignal`), `ctx.setInterval` and `ctx.exec` cover timers and child processes; what a plugin starts outside `ctx` lives until the next plugin host restart.
- Every `ctx` call in a server half crosses a process boundary, so the whole server API is asynchronous.
- **Hot reload**: a watcher on each plugin directory recompiles on change, deactivates the old version, then imports the new one with a hash in its URL. Reload takes well under a second, so an agent can edit, reload and look in one loop. Old module versions stay in the ESM cache; the plugin host is restarted when idle once enough have piled up.
- Rolldown doesn't type-check. `ivin plugin check <id>` runs the type checker against the plugin's `tsconfig.json`, and a reload reports type errors in `ivin plugin logs` without blocking the load.
- **Until the plugin host milestone**, built-in plugins are plain workspace modules imported statically and built with the app: same `activate(ctx)` shape and same `ctx`, no runtime loading. They move to the dynamic path when it exists.

### Error isolation

What is contained, and by what:

| Failure | Containment |
|---|---|
| Server half throws, or rejects a promise | caught in the plugin host, logged against the plugin, handler skipped |
| Server half loops or blocks | the host misses the server's heartbeat; the server kills it, restarts it, and disables the plugin whose handler was running |
| Server half crashes the host | same restart; sessions and agents are untouched, they live in the server |
| Plugin fails to activate | marked failed, the app goes on |
| UI contribution throws while rendering | its own error boundary shows "plugin `prs` failed — see `ivin plugin logs prs`" in place of the slot |
| UI contribution throws in an event handler or async code | caught by a window-level handler, attributed to the plugin by its bundle URL, logged |
| UI contribution blocks or loops the renderer | not containable in-process. Main sees the window unresponsive, reloads it with the plugins activated or reloaded last disabled, and says which |

**Safe mode** is the recovery of last resort: main records each launch, and after a crash or hang during startup the next launch disables user and project plugins and reports it. `ivin --safe` forces it, and `ivin plugin disable <id>` works from the CLI even when the window is unusable.

`console` output and errors are captured per plugin and readable through `ivin plugin logs <id>`, so the agent that wrote the plugin can debug it.

No sandbox in v1: plugins are local code chosen by the user, as in VS Code or Obsidian. The plugin host isolates failures, not permissions.

### Server API (`server.ts`)

```ts
import type { ServerPlugin } from "@ivin/plugin-api/server"

export const activate: ServerPlugin = (ctx) => {
  ctx.transcript.onEvent((session, event) => { /* every normalised event */ })
  ctx.sessions.onCreated((session) => {})
  await ctx.annotations.add(sessionId, { kind: "pr", data })
  await ctx.storage.get(key) / await ctx.storage.set(key, value)
  ctx.harness.beforeSpawn(async (spawn) => ({ env: { FOO: "1" } }))
  ctx.commands.register("prs.refresh", async (args) => {})   // also exposed as `ivin run prs.refresh`
  await ctx.commands.run("github.refresh", args)             // another plugin's command, with its result
  await ctx.exec("gh", ["pr", "view", url, "--json", "state"], { cwd })
  await ctx.settings.get("foldThreshold")
  ctx.poll(`pr:${url}`, refresh, { every: 60_000 })          // one run per key, paused while the window is hidden
  ctx.setInterval(tick, 60_000)                              // cleared on deactivate
}
```

### UI API (`ui.tsx`)

Plugins contribute React components to named **slots**. A slot receives typed props and renders every contribution in `order`; a contribution can declare `replaces` to take over a built-in one (e.g. a custom renderer for `Bash` tool calls). When several plugins replace the same contribution, one wins: the plugin from the most specific directory (project, then user, then built-in), then the lowest `order`; `ivin doctor` lists the losers.

Transcript slots render inside a virtualised list and once per item, so they receive transcript items, not raw events, and must stay cheap.

| Slot | Props | Used for |
|---|---|---|
| `transcript.message` | item, session | custom message rendering, skill highlights |
| `transcript.toolCall` | tool call item (call, result, status), session; matched by tool name | expandable commands, logs pill, subagent details |
| `transcript.inline` | markdown node | inline code links, issue mentions |
| `composer.status` | session | tokens, cost, branch PR |
| `composer.above` | session | approval sheet, queued messages, detail sheets |
| `composer.suggest` | trigger char, query | `#` issues, `@../` paths, `/` commands |
| `session.badge` | session | linked PR/issue icon in the sidebar and tabs |
| `session.card` | session | hover card sections |
| `sidebar.section` | — | Inactive sessions, Working panel, custom panels |
| `sidebar.panel` | — | a whole sidebar tab (Files, Changes…) |
| `tab.decoration` | tab | git status colour, session icon |
| `view` | params | a full tab or pane view |
| `settings.section` | — | a plugin's settings page (generated from `plugin.json` when absent) |

Plus non-visual contributions: `commands` (command palette), `keybindings`, `themes`, `fileIcons`, `editorExtensions` (CodeMirror), `fileOpeners` (HTML preview).

```tsx
import { defineUi, useAnnotations, useSession } from "@ivin/plugin-api/ui"

export const activate = defineUi((ctx) => {
  ctx.slots.add("session.badge", PrBadge, { order: 10 })
  ctx.slots.add("session.card", PrList)
})

function PrBadge({ sessionId }: { sessionId: string }) {
  const prs = useAnnotations(sessionId, "pr")
  return prs.length ? <PrIcon pr={prs[0]} extra={prs.length - 1} /> : null
}
```

Hooks available to plugin components: `useSession`, `useSessions`, `useTranscript` (items), `useAnnotations`, `useStorage`, `useSettings`, `useCommand`, plus the design system components (`Icon`, `Pill`, `HoverCard`, `Menu`…) so plugins look native.

### Plugins building on plugins

Plugins share through four soft channels; none makes a plugin fail when another is absent:

- **Annotations.** A kind shared by several plugins has its `data` shape defined in `contracts`, `pr` first. Whoever writes it and whoever renders it need not know each other.
- **Slots defined by a plugin.** `ctx.slots.define("prs.card.section")` opens a slot prefixed with the plugin's id. Contributions to a slot nobody defines never render.
- **Commands with a result.** `ctx.commands.run("github.refresh", args)` calls another plugin's command and returns its result, or fails with an "unknown command" error. These calls are untyped across plugins.
- **Core services**, for what no forge or tool owns: git, the account a project uses on a host, `ctx.poll`, `ctx.exec`.

The core knows no forge. GitHub is a built-in plugin (`github`: PR detection and polling with `gh`, `#` issue mentions) that writes `pr` annotations, and the `prs` plugin renders them. A GitLab plugin writing the same annotations gets the same UI.

Plugins declare no dependency on each other: that would bring load order, cascading reloads and an API version per plugin. It can come later as an optional manifest field, without breaking existing plugins, when a real feature needs typed calls into another plugin.

### API stability

`apiVersion` in the manifest. It stays at `0` until the fork is replaced (milestone 4): the API breaks freely while fork features are ported, and built-in plugins are fixed in the same commit. It is frozen as `1` at the switch; from then on the host refuses a plugin built for a newer major and warns on an older one. Built-in plugins pin the current version, so any breaking change shows up in our own code first.

## Agent-facing surface

### Files

```
~/.ivin/
  settings.json        JSONC, watched
  keybindings.json
  themes/<id>.json     colours + CSS; filename is the id
  plugins/<id>/
  cache/plugins/       compiled bundles, by content hash
  run/ivin.sock
<repo>/.ivin/
  settings.json        project settings (on-save commands…)
  plugins/<id>/
```

Writes go through a temp file and a rename, so the app never reads a half-written file. An invalid file keeps the last valid version and reports the parse error (`ivin doctor`).

### CLI

```
ivin session annotate --kind pr --data '{"url":"…","relation":"referenced"}'
ivin pr link <url> --as created|referenced|reviewed     # sugar over annotate
ivin theme set <id> | ivin theme list
ivin settings get|set <path> [value]
ivin plugin list | reload <id> | logs <id> | new <id>
ivin plugin check <id>                                  # type-check against the plugin API
ivin plugin enable|disable <id>
ivin run <command> [--args json]                        # any plugin command
ivin doctor
ivin --safe                                             # start with user and project plugins disabled
```

Commands default to `$IVIN_SESSION_ID`, so an agent annotates its own session without knowing its id.

### Skills and docs for agents

The app ships two skills, installed into supported harnesses on first run: `ivin-customize` (files, CLI, themes) and `ivin-plugin` (plugin format, API reference, slot list, the edit → `plugin check` → reload → `plugin logs` loop). `@ivin/plugin-api` types are the API reference; each built-in plugin is a worked example.

### MCP, later

Once the CLI is stable, an optional `ivin` MCP server can expose the same commands (no shell per call, structured results), injected through `harness.beforeSpawn` with an allowlist. It wraps the RPC layer; it never becomes the only way in.

## Example: session PRs

The feature that started this design, as two plugins: `github` knows the forge, `prs` shows pull requests whatever the forge.

- `github`'s `server.ts` watches `transcript.onEvent` for a `gh pr create` or GitHub MCP `create_pull_request` result holding a PR URL, and adds a `pr` annotation with `relation: "created"`. Deterministic, free, no agent cooperation needed.
- The agent adds what detection can't see with `ivin pr link <url> --as referenced`; the `ivin-customize` skill tells it when.
- `github` polls each open PR's state, CI and mergeability with `ctx.poll` and `ctx.exec("gh", …)`, and updates the annotation.
- `prs`'s `ui.tsx` reads the `pr` annotations and fills `session.badge` (state icon, CI chip, `+n`), `session.card` (folded PR list) and `tab.decoration`.

In the fork this took hooks in 10 upstream files; here it touches no core file.

## Porting the MonoCode fork

The fork's `docs/fork/` entries are the backlog. Each feature becomes a built-in plugin unless it is core behaviour.

This table lists what the fork added, not what it sits on. The base app MonoCode provides (editor, file explorer, diff, git, worktrees, tabs and panes, terminal, three harnesses) has to be rebuilt too, and is the larger part of the work; the milestones are ordered around it.

| Area | Fork features | Extension points |
|---|---|---|
| Core (not plugins) | worktree adoption, default-branch start, steer delivery, background tasks, stop on tab close, worktree cleanup, git spawn perf, dev builds | harness layer, session lifecycle |
| Transcript | expandable commands, background command logs, subagent detail sheet, sent skill highlight, inline code links, inline images, image gallery, user bubble | `transcript.*`, `composer.above`, themes |
| Composer | approval sheet, double Escape clear, `/clear`, Claude native commands, `#` issue mentions, `@../` mentions, status line | `composer.*`, `commands`, `keybindings` |
| Sessions & GitHub | branch PR link, multiple PRs, title-tab session card, GitHub account per project | `session.badge`, `session.card`, `tab.decoration`, annotations, `harness.beforeSpawn` (env `GH_TOKEN`) |
| Sidebar & layout | inactive sessions, Working panel, Monos collapse, stacked side panels, swap side panels, session sub-tabs, dock follows session | `sidebar.*`, `view`, layout API |
| Files & editor | explorer reveal and toolbar, code fonts, VS Code keys, tsgo navigation, HTML preview, tab git status, worktree icons, branch picker fetch and worktrees, code workspaces, project on-save commands | `editorExtensions`, `fileOpeners`, `fileIcons`, `tab.decoration`, project settings |
| Look | Gruvbox theme, tab dividers | `themes`, `fileIcons` |

Layout features (stacked or swapped panels, sub-tabs) are where the slot model is weakest; expect to grow a small layout API (`ctx.layout.registerPanel`, panel placement settings) while porting them.

## Build and release

- **One version.** The whole monorepo carries a single semver version, `0.x` until the switch. A plugin's `apiVersion` is a separate integer and does not follow it.
- **Packaging.** electron-builder, macOS arm64 only at first. `node-pty` is the one native module: it is rebuilt for Electron and unpacked from the asar archive.
- **Releases.** release-it bumps the version, writes the changelog from the conventional commits and tags `vX.Y.Z`; the tag starts a workflow that builds, signs, notarises and publishes a GitHub Release.
- **Updates.** `electron-updater` reads the GitHub Releases. Auto-update on macOS needs a signed and notarised app, so an Apple Developer ID; an unsigned build still runs when built locally.
- **Packaged early.** CI builds the packaged app and launches it from milestone 1 on, because `utilityProcess` paths, the asar archive and the native module only fail there.

## Milestones

1. **Skeleton**: Electron + server process + RPC, one project, Claude harness, transcript view, composer, SQLite. Slot renderer and `activate(ctx)` in place, with built-in plugins imported statically. A packaged build that launches, checked in CI.
2. **Daily driver, narrow path**: Claude only. Worktrees, tabs, sidebar, files, diff, terminal. The fork features used every day, each as a static built-in plugin, session PRs first. `ivin` CLI with `session annotate`, `settings`, `theme`. The plugin API takes its shape here, at `apiVersion: 0`. Signed releases and auto-update.
3. **Plugin host**: plugin host process, manifest, Rolldown loading, hot reload, error isolation, safe mode, content-hash trust, logs, `ivin plugin …`. Built-in plugins move to the dynamic path.
4. **Switch**: Codex and ACP harnesses; port the rest from `docs/fork/` as needed; stop adding features to the fork; freeze `apiVersion: 1`.
5. **Later**: MCP wrapper, headless server for remote and mobile, plugin sharing.

## Open questions

- Terminal emulator, to settle at milestone 2: xterm.js, or `libghostty-vt` compiled to WASM (e.g. `ghostty-web`, which keeps the xterm.js API, so the swap is cheap either way). The PTY lives in the server (`node-pty`) and only speaks bytes over RPC, so the choice stays local to one UI component. The full libghostty with its native renderer is out: a Metal surface doesn't compose inside a Chromium window.
- Plugin dependencies: may a plugin have its own `node_modules` (Rolldown would bundle them), or only the plugin API and Node built-ins?
- Evolving stored data. Owning the transcript means a change to an event's shape meets events already stored. The SQLite schema moves by numbered, forward-only migrations, run at server start in one transaction and recorded in the database; a server that finds a newer schema than it knows refuses to start. Still to settle: a version on transcript events and annotations, and whether old ones are rewritten or upcast on read.
