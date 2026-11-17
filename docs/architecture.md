# ivin — architecture

ivin is a desktop app to run and supervise coding agents (Claude Code, Codex, ACP agents), built so that **the user's agents can change it**: through files and a CLI for anything declarative, and through TypeScript plugins for anything else.

It replaces a fork of MonoCode that grew to 167 commits, 54 features and 142 touched upstream files, where every feature was first shaped by the cost of the next upstream merge. ivin starts from what that fork taught: which extension points a real feature set needs (see [Porting the fork](#porting-the-monocode-fork)).

## Principles

1. **Everything is a plugin, including our own features.** Built-in features use the public plugin API. If one can't, the API is missing something; fix the API, not the feature.
2. **Files and a CLI before tools.** Settings, themes, keybindings and session annotations live in watched files and are reachable through the `ivin` CLI. Agents already master files and shells, on every harness, with no injection. MCP comes later, only as an optimisation.
3. **A broken plugin never breaks the app.** Agents write most plugins; errors are contained to the plugin's own slot and reported where the agent can read them.
4. **Don't reinvent the harness layer.** Provider protocols come from T3 Code and MonoCode (both MIT, attribution kept in `NOTICE`).
5. **Effect inside, plain TypeScript at the edge.** The core is written with Effect v4; the plugin API is functions, promises and React hooks.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron | Node in the backend, so plugins have a backend half in TS; one Chromium everywhere; most mature desktop runtime |
| UI | React + TypeScript | What agents write best; plugin UI is just React components |
| Core | Effect v4 (stable since 2026-09-30) | Long-lived processes, streams, cancellation and scoped resources are the harness layer's daily work |
| Contracts | Effect `Schema` | One definition for RPC payloads, persisted data and transcript parsing |
| Storage | SQLite (`node:sqlite`) | Sessions, transcripts index, plugin storage; files stay files |
| Plugin build | esbuild, in process | Plugins are `.ts` sources compiled on load; no build step for the author |
| Monorepo | pnpm workspaces, Vitest, Playwright | |

GPUI (or any native Rust UI) was considered and rejected: UI plugins in Rust mean WASM or dynamic libraries with no stable ABI, Zed itself can't offer UI extensions on it, and agents write Rust/GPUI far worse than TS/React. Tauri was rejected because its backend is Rust, which would confine plugins to the webview.

## Processes

```
┌────────────── Electron main ──────────────┐
│ windows, menus, native dialogs, updater   │
│ spawns ↓, brokers ports                   │
└───────┬───────────────────────┬───────────┘
        │ MessagePort (RPC)     │
┌───────▼────────────┐  ┌───────▼────────────────────────┐
│ renderer (React)   │  │ server (utilityProcess, Effect)│
│ UI + plugin UI     │◄─┤ sessions, harnesses, git, gh,  │
│ halves             │  │ store, file watchers, plugin   │
└────────────────────┘  │ server halves, CLI socket      │
                        └───────▲────────────────────────┘
                                │ unix socket (JSON-RPC)
                        ┌───────┴────────┐
                        │ `ivin` CLI     │  ← agents, scripts, the user
                        └────────────────┘
```

- **server** runs in an Electron `utilityProcess`, so a slow git call or a plugin's heavy work never freezes the window, and the same server can later run headless (remote machine, web client, mobile) like T3 Code's.
- **main** stays thin: windows and OS integration only.
- **renderer ↔ server** use typed RPC over a `MessagePort`, defined in `packages/contracts` with Effect `Schema` (requests, plus streams for live state).
- **CLI ↔ server** use JSON-RPC over a unix socket (`~/.ivin/run/ivin.sock`). The CLI is a thin client; every command is also an RPC the UI can call.

## Repository layout

```
apps/
  desktop/          Electron main + preload, packaging
  cli/              `ivin` binary (thin RPC client)
packages/
  contracts/        Schema: RPC, domain types, transcript events, plugin manifest
  server/           Effect services: Sessions, Harness, Git, GitHub, Store, PluginHost, CliSocket
  harness/          providers: claude, codex, acp (+ shared transcript normalisation)
  ui/               React app shell, slot renderer, design system
  plugin-api/       public API types + runtime shims (the only package plugins import)
plugins/            built-in plugins, same format as user plugins
docs/
```

## Domain model

- **Project**: a folder or a `.code-workspace` (several folders), with its settings.
- **Session**: one agent conversation, bound to a project folder, a cwd (checkout or worktree), a branch, a harness and a model. Owns a transcript.
- **Transcript**: an append-only list of normalised events (`user_message`, `assistant_text`, `thinking`, `tool_call`, `tool_result`, `approval_request`, `usage`, `status`…). Provider-specific payloads are kept in a `raw` field so plugins can read what the normalisation drops.
- **Annotation**: typed, namespaced metadata attached to a session (or project), written by plugins, the CLI or the agent. Example: `{ ns: "prs", kind: "pr", data: { url, relation: "created" } }`. This is the generic answer to "link these PRs to this session".
- **Tab / pane layout**: workspace tabs holding session, file and plugin views.

The server is the source of truth and persists to SQLite; the renderer holds a read model fed by RPC streams. Plugin storage is a namespaced key-value store in the same database.

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
- Source material: T3 Code's provider layer (already Effect + Schema) first; MonoCode's `src/integrations/harness` for the providers and edge cases T3 Code lacks.
- Every spawned agent gets `IVIN_SESSION_ID` and `IVIN_SOCKET` in its environment, so `ivin` commands run by the agent apply to its own session with no argument.
- Plugins can amend a spawn (`harness.beforeSpawn`: extra args, env, MCP servers, appended system prompt) and observe every event (`transcript.onEvent`).

## Plugin system

### On disk

```
<plugins dir>/prs/
  plugin.json
  server.ts      optional, runs in the server process
  ui.tsx         optional, runs in the renderer
  README.md      what it does, for the next agent that edits it
```

```json
{
  "id": "prs",
  "name": "Session PRs",
  "version": "0.1.0",
  "apiVersion": 1,
  "server": "server.ts",
  "ui": "ui.tsx",
  "settings": { "foldThreshold": { "type": "number", "default": 2 } }
}
```

Plugin directories, loaded in this order (a later one with the same `id` overrides an earlier one):

1. built-in: `plugins/` in the app bundle;
2. user: `~/.ivin/plugins/`;
3. project: `<repo>/.ivin/plugins/` (asked once per repo before loading: it runs code).

### Loading

- The server compiles `server.ts` and `ui.tsx` with esbuild on load (cached by content hash in `~/.ivin/cache/plugins`).
- `react`, `react-dom` and `@ivin/plugin-api` are externals provided by the host (import map in the renderer, module aliases in the server), so there is exactly one React instance.
- Each half exports `activate(ctx)`; everything it registers through `ctx` is disposed automatically on deactivate.
- **Hot reload**: a watcher on each plugin directory recompiles on change, deactivates the old version, then imports the new one with a hash in its URL. Reload takes well under a second, so an agent can edit, reload and look in one loop.

### Error isolation

- Every UI contribution renders inside its own error boundary, which shows "plugin `prs` failed — see `ivin plugin logs prs`" in place of the slot.
- Every event handler and hook runs in a try/catch with a time budget; a throwing or slow handler is logged and skipped, never allowed to block the event.
- A plugin that fails to activate is marked failed and the app goes on.
- `console` output and errors are captured per plugin and readable through `ivin plugin logs <id>`, so the agent that wrote the plugin can debug it.

No sandbox in v1: plugins are local code chosen by the user, as in VS Code or Obsidian. Project plugins are the only ones gated by a prompt.

### Server API (`server.ts`)

```ts
import type { ServerPlugin } from "@ivin/plugin-api/server"

export const activate: ServerPlugin = (ctx) => {
  ctx.transcript.onEvent((session, event) => { /* every normalised event */ })
  ctx.sessions.onCreated((session) => {})
  ctx.annotations.add(sessionId, { kind: "pr", data })
  ctx.storage.get(key) / ctx.storage.set(key, value)
  ctx.harness.beforeSpawn((spawn) => ({ env: { FOO: "1" } }))
  ctx.commands.register("prs.refresh", async (args) => {})   // also exposed as `ivin run prs.refresh`
  ctx.exec("gh", ["pr", "view", url, "--json", "state"], { cwd })
  ctx.settings.get("foldThreshold")
}
```

### UI API (`ui.tsx`)

Plugins contribute React components to named **slots**. A slot receives typed props and renders every contribution in `order`; a contribution can declare `replaces` to take over a built-in one (e.g. a custom renderer for `Bash` tool calls).

| Slot | Props | Used for |
|---|---|---|
| `transcript.message` | event, session | custom message rendering, skill highlights |
| `transcript.toolCall` | call, result, session (matched by tool name) | expandable commands, logs pill, subagent details |
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

Hooks available to plugin components: `useSession`, `useSessions`, `useTranscript`, `useAnnotations`, `useStorage`, `useSettings`, `useCommand`, plus the design system components (`Icon`, `Pill`, `HoverCard`, `Menu`…) so plugins look native.

### API stability

`apiVersion` in the manifest; the host refuses a plugin built for a newer major and warns on an older one. Built-in plugins pin the current version, so any breaking change shows up in our own code first.

## Agent-facing surface

### Files

```
~/.ivin/
  settings.json        JSONC, watched
  keybindings.json
  themes/<id>.json     colours + CSS; filename is the id
  plugins/<id>/
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
ivin run <command> [--args json]                        # any plugin command
ivin doctor
```

Commands default to `$IVIN_SESSION_ID`, so an agent annotates its own session without knowing its id.

### Skills and docs for agents

The app ships two skills, installed into supported harnesses on first run: `ivin-customize` (files, CLI, themes) and `ivin-plugin` (plugin format, API reference, slot list, the edit → reload → `plugin logs` loop). `@ivin/plugin-api` types are the API reference; each built-in plugin is a worked example.

### MCP, later

Once the CLI is stable, an optional `ivin` MCP server can expose the same commands (no shell per call, structured results), injected through `harness.beforeSpawn` with an allowlist. It wraps the RPC layer; it never becomes the only way in.

## Example: session PRs

The feature that started this design, as a plugin:

- `server.ts` watches `transcript.onEvent` for a `gh pr create` or GitHub MCP `create_pull_request` result holding a PR URL, and adds a `pr` annotation with `relation: "created"`. Deterministic, free, no agent cooperation needed.
- The agent adds what detection can't see with `ivin pr link <url> --as referenced`; the `ivin-customize` skill tells it when.
- The plugin polls each open PR's state, CI and mergeability with `ctx.exec("gh", …)` and stores it.
- `ui.tsx` fills `session.badge` (state icon, CI chip, `+n`), `session.card` (folded PR list) and `tab.decoration`.

In the fork this took hooks in 10 upstream files; here it touches no core file.

## Porting the MonoCode fork

The fork's `docs/fork/` entries are the backlog. Each feature becomes a built-in plugin unless it is core behaviour.

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

## Milestones

1. **Skeleton**: Electron + server process + RPC, one project, Claude harness, transcript view, composer, SQLite. Slot renderer in place even with only built-in contributions.
2. **Plugin host**: manifest, esbuild loading, hot reload, error isolation, logs, `ivin` CLI with `plugin` and `session annotate`. First built-in plugin: session PRs.
3. **Daily driver**: Codex and ACP harnesses, worktrees, tabs, sidebar, files and diff. Port the fork features needed day to day, each as a plugin.
4. **Switch**: stop adding features to the fork; port the rest from `docs/fork/` as needed.
5. **Later**: MCP wrapper, headless server for remote and mobile, plugin sharing.

## Open questions

- Transcript storage: keep the providers' own files (Claude's JSONL) as the source and index them, or own a copy of every event? Owning a copy simplifies plugins; indexing avoids drift on resume.
- Renderer state: Effect atoms on top of the RPC streams, or a plain store (Zustand) fed by them? The plugin hooks hide the choice either way.
- How much of T3 Code's server to take as-is versus re-deriving from MonoCode, after reading both provider layers side by side.
- Project plugins: trust per repo, or per commit of `.ivin/plugins/`?
