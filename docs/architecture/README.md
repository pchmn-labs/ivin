# ivin — architecture

ivin is a desktop app to run and supervise coding agents (Claude Code, Codex, ACP agents), built so that **the user's agents can change it**: through files and a CLI for anything declarative, and through TypeScript plugins for anything else.

It replaces a fork of MonoCode that grew to 167 commits, 54 features and 142 touched upstream files, where every feature was first shaped by the cost of the next upstream merge. ivin starts from what that fork taught: which extension points a real feature set needs (see [Porting the fork](#porting-the-monocode-fork)).

## Principles

1. **Everything is a plugin, including our own features.** Built-in features use the public plugin API. If one can't, the API is missing something; fix the API, not the feature. The API stays free to break until the fork is replaced (see [API stability](#api-stability)): it is shaped by porting real features, not designed ahead of them.
2. **Files and a CLI before tools.** Settings, themes and keybindings live in watched files, and they and session annotations are reachable through the `ivin` CLI. Agents already master files and shells, on every harness, with no injection. MCP comes later, only as an optimisation.
3. **A broken plugin must not take the app down, and the app always recovers.** Agents write most plugins. Server halves run in their own process, which can be killed without touching running sessions; UI errors are contained to the plugin's slot where React allows it, and safe mode covers the rest. Errors are reported where the agent can read them.
4. **Don't reinvent the harness layer.** Provider protocols come from T3 Code and MonoCode (both MIT, attribution kept in `NOTICE`).
5. **Light and leak-free by default.** Every feature is built to hold only what it needs (see [Performance and memory](#performance-and-memory)).
6. **Effect inside, plain TypeScript at the edge.** The core is written with Effect v4; the plugin API is functions, promises and React hooks.
7. **No harness is special.** ivin runs sessions on several harnesses (Claude Code, Codex, ACP agents), and Claude Code is one implementation of the `HarnessProvider` port among them. Only a provider's own module in `packages/harness` knows a harness's protocol, flags, names or tools; everything else speaks of "the agent" and reads the session's harness when it must show its name, mark or run options.

## Stack

| Concern | Choice | Why |
|---|---|---|
| Shell | Electron | Node in the backend, so plugins have a backend half in TS; one Chromium everywhere; most mature desktop runtime |
| UI | React + TypeScript | What agents write best; plugin UI is just React components |
| Code view | CodeMirror 6 | Viewport rendering and incremental parsing keep a large file responsive; each language package loads only when a file of its language opens. One setup (`core/components/code-view`) for reading, editing and diffs |
| UI state | Effect `Atom` (`effect/reactivity`) + `@effect/atom-react` | One model from server to screen: RPC streams feed atoms, components read atoms |
| Core | Effect v4 (stable since 2026-09-30) | Long-lived processes, streams, cancellation and scoped resources are the harness layer's daily work |
| Contracts | Effect `Schema` | One definition for RPC payloads, persisted data and transcript parsing |
| Storage | SQLite (`node:sqlite`) | Sessions, transcript events, plugin storage; files stay files. No native module to rebuild; checked in a `utilityProcess` on Electron 45 (WAL, JSON operators, FTS5) |
| Plugin build | Rolldown (Oxc transform), in process | Plugins are `.ts` sources compiled on load; no build step for the author. Same bundler as Vite, so app and plugins resolve and transform code the same way |
| Toolchain | VoidZero stack, through Vite+ (`vp`) | One CLI and one parser (Oxc) for dev server, build, tests, lint and format |
| Monorepo | pnpm workspaces, `vp` task runner | |

### Toolchain

All build and quality tools but one come from the VoidZero open-source stack (MIT):

| Tool | Used for |
|---|---|
| Vite (Rolldown-based) | renderer dev server with HMR, renderer build |
| tsdown | `main`, `preload`, `server`, `cli` and the publishable packages (`contracts`, `plugin-api`) |
| Rolldown | plugin compilation at runtime (its JS API, with host modules as externals) |
| Vitest | unit and component tests; Vitest browser mode for UI tests |
| Oxlint | lint, with type-aware rules; it also enforces the import rules of the [code layout](#code-layout) and the style rules of the UI's TSX |
| Oxfmt | format |
| Vite+ (`vp`) | single entry point for the above, cached monorepo tasks, Node and pnpm versions |

Stylelint (MIT) lints the UI's CSS against its colour and token rules, as Oxlint reads no CSS; `pnpm lint` runs both.

Vite+ is still in beta: the repo keeps a plain config per tool, so dropping `vp` for direct tool calls stays a script change. `vp lint` and `vp fmt` are passed their config with `-c` (`.oxlintrc.json`, `.oxfmtrc.json`), because `vp` only reads such options from `vite.config.ts`; `vp check` has no `-c` and is not used. Each package that bundles keeps its options in `tsdown.config.ts`, and its `vite.config.ts` imports them as `pack`. Build, dev and type-check tasks run through `vp run`. Electron packaging (electron-builder) and end-to-end tests (Playwright driving Electron) are outside this stack.

GPUI (or any native Rust UI) was considered and rejected: UI plugins in Rust mean WASM or dynamic libraries with no stable ABI, and Zed itself can't offer UI extensions on it. Tauri was rejected because its backend is Rust, which would confine plugins to the webview.

Effect v4 is recent, so agents will often write v3 idioms in the core. That cost is accepted and kept away from plugin authors by principle 6; the core's `AGENTS.md` must point at the v4 docs and at in-repo examples.

## Processes

```
┌────────────── Electron main ──────────────┐
│ windows, menus, native dialogs            │
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
- **plugin host** (not built yet) is a second `utilityProcess` that runs every plugin's server half. A plugin that loops or crashes takes the host down, not the server: sessions keep running, and the server restarts the host without the faulty plugin (see [Error isolation](#error-isolation)).
- **main** stays thin: windows, OS integration, and the crash bookkeeping behind safe mode.
  The window never leaves the page it loaded: a web or mail link, clicked or opened in a new window, opens in the default browser through `shell.openExternal`, and any other navigation is dropped.
- **One RPC contract, several transports.** `packages/contracts` defines every request and stream once with Effect `Schema`. The renderer reaches it over a `MessagePort`, the plugin host over another, the CLI over a unix socket (`~/.ivin/run/ivin.sock`, mode 0600, one JSON message per line, limited to the CLI's RPCs), and a headless client later over a WebSocket. Every CLI command is an RPC the UI can call. A handler that dies fails only its own request: the RPC server runs with `disableFatalDefects`, so the connection's other streams keep running. `~/.ivin` and its log folders are created readable by the user only (mode 0700).

## Repository layout

```
apps/                 what runs: each has a `main` and is imported by nothing
  desktop/            Electron main + preload, packaging. Thin, flat
  server/src/
    rpc/              the public seam: one handler per RPC, a use case given its dependencies; composes the Layers that need no configuration
    modules/<subject>/
      rules/          pure and synchronous
      usecases/       Effect programs, one file per intention, the ports they need, and the stateful Layers that need no outside
      adapters/       Layers that reach the outside: SQLite, child processes, file watchers, sockets
    shared/
    main.ts           adds the configured Layers (paths, the harness, the database) and starts the server
  plugin-host/        (not built yet) entry of the plugin host process: loads server halves, implements `ctx` over RPC. Flat
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
    core/             design system (`components/<component>/`, `theme/`), the RPC client service
  state/              atom families, optimistic writes, stream bridging (`@ivin/state`)
  plugin-api/         entry points `server.ts`, `ui.ts` and `editor.ts` (the host's CodeMirror): types + runtime shims (the only package plugins import)
tools/                repo tooling: `lint-rules/` tests the ADR-0001 import rules of `.oxlintrc.json` and the UI style rules of `.oxlintrc.json` and `.stylelintrc.json`, `test-setup/` runs before every `node` test
plugins/<id>/         built-in plugins, same format as user plugins; `src/rules/`, `src/ui/` and `src/hooks/` beside the two halves when one has logic or a UI too big for `ui.tsx`
docs/
```

### Code layout

The subject comes before the layer: a package with logic has one module per term of the domain model, named the same in `contracts`, `server` and `ui`, and what a test of a file needs decides its layer (`rules/`, `usecases/`, `atoms/`, `hooks/`, `ui/`, `adapters/`). Oxlint enforces that pure code imports nothing impure and that orchestration imports no adapter. The server's modules import each other in one order ([ADR-0012](../adr/0012-server-modules-import-each-other-in-one-order.md)); every other direction is navigation. Packages too thin to have layers (`desktop`, `cli`, `contracts`, `state`, `plugin-api`) stay flat.

The rules per package are in [`docs/conventions/`](../conventions/README.md), the reasons in [ADR-0001](../adr/0001-code-grouped-by-subject-and-layered-by-test.md).

Tests sit beside the file they test, at three levels:

- **Rules**, called directly. Harness parsing runs on recorded provider output kept as fixtures.
- **Server**, through the `rpc/` handlers, with an in-memory SQLite and a scripted `HarnessProvider` that replays a recorded transcript. No test spawns a real agent.
- **App**, a few Playwright runs on the same scripted provider.

## Domain model

The terms are defined in [`GLOSSARY.md`](../../GLOSSARY.md). What the design adds to them:

- Transcript events are `user_message`, `assistant_text`, `thinking`, `tool_call`, `tool_result`, `approval_request`, `approval_decision`, `question_request`, `question_answer`, `request_unanswered`, `usage`, `status`, `error`, `interruption`, `working_folder`, `run_option`… Each is written to SQLite as it streams, never re-read from the provider's files.
- Token deltas are not events: they go to the renderer and are never stored, and the finished block is stored once, under the id its streamed copy had.
- A harness reads the provider's own line (`raw`) while it normalises it; the stored event leaves it out.

Each module this list describes has its own file, covering its server and UI sides:

- [Session](session.md): pending messages, working folder and branch, title, run options, a deleted working folder, following the agent's folder, switching or fast-forwarding the checkout, archiving and deleting.
- [Worktree](worktree.md): reading worktrees through the `Git` port, the branch picker, removing merged worktrees.
- [Transcript](transcript.md): how plugins read transcript items, and why ivin owns the transcript.
- [Annotation](annotation.md): the shape, storage and kinds of annotations.
- [Project](project.md): the open projects and tabs restored at launch.
- [Tab](tab.md): a tab's position, its sub-views, and closing it.
- [File](file.md): file links in answers, reading, listing, watching, diffing, discarding and writing files, unsaved edits.

The server is the source of truth and persists to SQLite; the renderer holds a read model fed by RPC streams, in atoms that the plugin hooks wrap (see [UI state](#ui-state)). Plugin storage is a namespaced key-value store in the same database.

### UI state

The renderer is Effect end to end: each RPC stream from the server feeds an `Atom`, derived atoms compute views (sorted sessions, a session's PRs), and components read them with `@effect/atom-react` hooks (Suspense for async results). Plugin hooks (`useSession`, `useAnnotations`…) are thin wrappers over these atoms, and plugins may also define and read atoms of their own.

`effect/unstable/*` modules, reactivity included, can break in minor releases: pin Effect to an exact version and upgrade deliberately.

Why atoms rather than Zustand stores (T3 Code mixes both, Zustand for local UI state): one model for plugins to learn instead of two; server streams become atoms with no glue; per-entity atoms are released with their readers, where Zustand stores are global and live until cleaned by hand. The state layer sits behind `@ivin/state` (atom families, optimistic writes, stream bridging), so a swap would stay contained.

### Responsiveness

- **Normalised, fine-grained state.** A list atom holds ids; each session, message and tool call is its own atom in a family. Appending a message or streaming into one re-renders that row only.
- **Optimistic by default.** Sending, renaming, archiving, closing a tab or reordering updates the atom at once and reconciles with the server's answer; the server is local, so it rarely waits more than a frame.
- **Frame-batched streaming.** Token deltas are coalesced per animation frame before reaching atoms; finished Markdown blocks are memoised and only the open block is re-parsed (an unclosed code block too: a perf test shows that stays above the frame-rate threshold). Relative times share one clock that stops while the window is hidden, and a folded tool output is not in the page.
- **Virtualised lists** for transcripts, sidebar and file trees; React Compiler for memoisation; transitions (`useTransition`, `useDeferredValue`) for heavy views such as diffs and search.
- **Perf tests**: stream a 10k-token answer and scroll a 2k-event transcript, failing below a frame-rate threshold.

Queries run in the server against SQLite and stream their results; the renderer never holds a client-side copy of whole collections. A client database such as TanStack DB (live queries over in-memory collections) would duplicate data the server already indexes and add a second reactive model next to atoms; reconsider only if cross-collection queries in the renderer become heavy.

## Performance and memory

Targets, not yet checked in CI: idle memory of all processes, cold start to first paint, and heap growth after the leak scenario below.

- **Transcripts are paged, not loaded.** The renderer holds a window of events around the viewport (virtualised list) and asks the server for more. A user message's images are files in the `images` folder beside the database, one folder per session, with their numbers in an `images` table; the event references them by id and number, and a thumbnail loads its file through `ivin-image://` when it mounts. When a session's last tab closes, its images are re-encoded as WebP, and the `images` row records the stored type the server reports to the window ([ADR-0005](../adr/0005-sent-images-are-files-served-to-the-window-by-the-desktop-app.md)).
- **Atoms die with their readers.** No `keepAlive` by default; per-session atom families are released when no component reads them. The exception is the transcript of a session with a tab, in any open project: it stays fed while the tab is open, so switching tabs shows it at once, scrolled where it was left (at its new end if it was left at its end), and is released when the tab closes. While its tab is not on screen, a transcript left at its end keeps only its last page (50 items), so scrolling back through a long session does not hold every page for as long as the tab is open; one left scrolled back keeps what it has.
- **Stopping an agent stops its process group.** The harness starts each agent as the leader of its own group and signals the group (SIGTERM, then SIGKILL after the grace period), so the shells and dev servers it started stop too. A grandchild that starts its own group still escapes.
- **Everything long-lived is scoped.** Child processes, watchers, subscriptions and timers live in an Effect `Scope` (server) or in the plugin's `ctx` (plugins), closed with their session, tab or plugin.
- **Bounded streams.** Harness streams have bounded buffers with backpressure. Each watcher of a server feed (transcript items, sessions, annotations) has its own bounded buffer, filled only with what it watches and never making the writer wait. A watcher whose buffer overflowed drops it and gets the current state again, so a slow renderer drops to a snapshot instead of queuing events: for items the last page and the open tool calls and requests older than it, for sessions and annotations the removals it missed and then the current list.
- **Stored rows are checked.** Every row read from SQLite is decoded with its contract schema, and a field added since the row was stored takes the schema's default. A transcript event or item, or an annotation, that no longer matches is left out and logged once; a session whose stored messages or run options no longer match shows with them empty, and the log says so. A request never fails on one bad row.
- **SQLite writes with fewer syncs.** The database runs in WAL with `synchronous = NORMAL`, which can lose the last commits on a power cut but never corrupts the file, and reuses its prepared statements. An event, its item and the session's last activity time are written in one transaction.
- **Shared, paused polling.** Polling goes through one scheduler, `ctx.poll` for plugins: deduplicated per key and paused while the window is hidden. A plugin stops polling what can no longer change, such as a merged PR.
- **Lazy plugins.** Every UI half is imported when the window starts, and its `activate` registers everything the plugin contributes right away. A plugin's heavy code (a panel, an overlay, a theme) sits in other files, loaded with `import()` from a slot component when the slot first renders; the host shows its loading indicator meanwhile. A user plugin is bundled with code splitting, and the desktop app serves the chunks beside the entry file. Loading the server half on demand is planned: it would load when the half first receives an event or runs a command, unless the plugin declares `"activation": "startup"`.
- **One renderer.** No extra `BrowserWindow` or `WebContentsView` per tab; the renderer is one bundle at startup. The file view, the diff view, the settings screen, CodeMirror (with its languages), the less used icons and the heavy parts of plugins load on first use.
- **Leak test** (planned). A Playwright scenario opens and closes 50 sessions, switches tabs and reloads a plugin 20 times, forces GC, and fails if heap or open handles grow past a threshold.

## Harness layer

Each provider implements one Effect service:

```ts
interface HarnessProvider {
  readonly id: "claude" | "codex" | "acp" | "scripted"
  readonly start: (input: StartInput) => Effect<HarnessRun, HarnessError, Scope>
  readonly toolKind: (name: string) => ToolKind
  // One prompt to a small model, outside any session; null when the harness has none.
  readonly completeText: ((prompt: string) => Effect<string, HarnessError>) | null
}
interface HarnessRun {
  readonly events: Stream<HarnessEvent | HarnessDelta, HarnessError>
  readonly send: (message: UserMessage) => Effect<void, HarnessError>
  // An approval's allow or deny, or the answers to the agent's questions (null declines them).
  readonly respond: (answer: ApprovalDecision | QuestionAnswers) => Effect<void, HarnessError>
  readonly interrupt: Effect<void>
}
```

- Claude: `-p --output-format stream-json --input-format stream-json --verbose --include-partial-messages --thinking-display summarized --model <model> --effort <effort> --permission-mode <mode>`, approvals over stdio. Its `AskUserQuestion` tool reaches ivin as an approval request, which the harness turns into a `question_request`; the answers go back as that tool's input, each question's labels joined by ", ". Without `--thinking-display summarized`, thinking arrives empty. Codex: `app-server` JSON-RPC. ACP: one generic client for Cursor, Devin, Grok, Hermes and others.
- Reference implementations: T3 Code's provider layer and MonoCode's `src/integrations/harness`. Both are read before writing a provider, for the protocol details and edge cases they already solved (flags, message shapes, approval flow, resume, interrupts). Code is copied or adapted where it fits ivin's interfaces, with attribution; neither is a dependency, and nothing requires matching their structure or their Effect version.
- The server picks the provider from `IVIN_HARNESS`, `claude` when unset; tests and the CI smoke run set it to `scripted`, which replays a recorded transcript and never spawns an agent. `scripted-approval` replays the same transcript, then a turn that waits for an approval, and `scripted-question` the same with a turn that asks two questions. `scripted-shot`, which `pnpm --filter @ivin/desktop shot` uses, adds a turn of several tool calls and a Markdown answer, the question turn, and a turn that streams its answer around an approval, between the two. An unpackaged main process loads the renderer from `packages/ui/dist`.
- With `IVIN_BACKGROUND=1` the desktop app opens out of sight: no Dock icon on macOS, and its window is never shown but keeps rendering. The e2e launch helper and `shot` set it.
- **Data folders.** The installed app keeps its database, sent images and `ivin` command in Electron's `userData` folder (`~/Library/Application Support/@ivin/desktop`) and its files in `~/.ivin`. A build that is not packaged (`pnpm dev`) uses `<appData>/ivin-dev` and `~/.ivin-dev` instead and starts empty, so an agent that runs `pnpm dev` never touches the user's sessions. `--user-data-dir` overrides the first, `IVIN_HOME` the second.
- **Application menu.** Main replaces Electron's default menu with the app, Edit, View and Window menus, without Close, so ⌘W reaches the window's `tab.close` keybinding; ⌘Q and the window's close button still quit and close.
- **One app per data folder.** Main takes Electron's single-instance lock, which is per `userData` folder. A second launch on the same folder quits and brings the open window to the front (not under `IVIN_BACKGROUND`). Two `pnpm dev` from two worktrees are not supported.
- **Restarting the server.** Main starts the server in `startServer()`, and the server tells main it is ready once its database is open. When the process exits on its own, main tells the window (`ivin:server:state`: restarting) and starts it again, at most 3 times in a minute; a server that stops before it was ready, or a fourth stop in a minute, makes main give up (state gave-up, with the log's path) until the user presses Restart. The window ends its requests in flight with an error, and when the server is back it opens a new port: it is not reloaded, because drafts and unsaved edits live in its memory. The new server sets the sessions that were working to idle. A server that cannot start writes why to `~/.ivin/logs/ivin.log`. When the window reloads or closes, the server stops the RPC server of its old port, which ends its streams and closes their watchers.
- **Updating the app.** Main checks GitHub's releases (`IVIN_UPDATE_URL` replaces `https://api.github.com/repos/pchmn-labs/ivin/releases` in tests) at launch and every hour, unless `updates.automaticCheck` is false in `settings.json`, which main reads before each check; the Check for updates command (`update.check`) runs one whatever the setting says. Only a packaged macOS arm64 build does it. With `updates.beta` off, main reads the latest stable release (`/releases/latest`, which leaves out pre-releases); with it on, the newest of the last 30 releases, beta or stable, in semver order. A 404, as before the first stable release, means no update. Left out of the file, `updates.beta` is on when `app.getVersion()` is a beta (`defaultSettingsFor` in `contracts`, which the server gets through `SettingDefaults`). When the release is newer than `app.getVersion()` and its `manifest.json` (see [ADR-0013](../adr/0013-releases-are-unsigned-and-published-by-a-workflow-started-by-hand.md)) names a zip the release has, main checks that the app's folder is writable, downloads the zip with Node's `fetch` (never a path that adds a quarantine attribute, which is why macOS lets the unsigned app run), compares its size and SHA-512 with the manifest's, unpacks it into `userData/updates` and tells the window (`ivin:update:state`: idle, checking, downloading with a percentage, ready, or failed as network, fingerprint or notWritable). A zip that does not match is deleted. The app replaces itself when it quits: a detached `/bin/sh` waits for the process to exit, moves the bundle aside, moves the new one in (and back if that fails), and, when the user clicked Restart to update, starts the new app with the old one's arguments. Quitting by hand replaces the bundle and does not relaunch. The app never restarts on its own, and stops the server and its agents as any quit does; they resume with the next message.
- Every spawned agent gets `IVIN_SESSION_ID` and `IVIN_SOCKET` in its environment, and the folder holding `ivin` first on its `PATH`, so `ivin` commands run by the agent reach this app and apply to its own session with no argument. Main sets `IVIN_SOCKET` and `PATH` on the server process, and the agents inherit them. An app opened from the Dock gets a bare `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`), so the server reads the `PATH` of the user's login shell (`$SHELL -ilc`, 5 s at most) in the background and puts its folders before the app's own, except the app's folders that come before the first folder both list (the `ivin` folder, a test's fake agent, a folder the launching terminal added), which stay first; when that read fails, the app's `PATH` stays and the log says so. The server answers RPCs at once while it reads: only git commands and agent processes (runs, the model list, titles, and `server.doctor`'s agent lookup) wait for the read, and installing the `ivin` command reuses its result. The scripted harnesses spawn no agent and skip the read.
- Plugins can amend a spawn (`harness.beforeSpawn`: extra args, env, MCP servers, appended system prompt) and observe every event (`transcript.onEvent`).
- `transcript.onEvent` is an observer: events are forwarded to the plugin host after they are persisted, and a slow plugin only delays itself.
- `harness.beforeSpawn` is on the spawn's critical path, so its rules are explicit. Hooks run in plugin load order; each returns a patch that is merged (env and args append, a later plugin wins on the same env key). A hook that throws or exceeds 2 s is skipped, the spawn goes on, and the session shows a warning naming the plugin.

## Plugin system

### On disk

```
<plugins dir>/prs/
  package.json   the manifest is its `ivin` key
  tsconfig.json  generated by `ivin plugin new`, resolves `@ivin/plugin-api` to the app's types
  README.md      what it does, for the next agent that edits it
  src/
    server.ts    optional, runs in the plugin host process
    ui.tsx       optional, runs in the renderer: activate(ctx) only, its entry
    ui/          optional, one component per file
    hooks/       optional, one use-<name>.ts hook per file
    rules/       optional, the plugin's pure logic
```

```json
{
  "name": "ivin-plugin-prs",
  "version": "0.1.0",
  "peerDependencies": { "@ivin/plugin-api": "^0" },
  "ivin": {
    "id": "prs",
    "name": "Session PRs",
    "server": "src/server.ts",
    "ui": "src/ui.tsx",
    "settings": { "foldThreshold": { "type": "number", "default": 2 } }
  }
}
```

`ivin.id` is the plugin's id, which prefixes its commands and contributions; the rest of the file keeps its npm meaning, so the version is the top-level `version`. A built-in plugin has `"private": true`.

Plugin directories, loaded in this order (a later one with the same `id` overrides an earlier one):

1. built-in: `plugins/` in the app bundle;
2. user: `~/.ivin/plugins/`;
3. project: `<repo>/.ivin/plugins/` (gated by a trust prompt, see below).

### Project plugin trust

A project plugin lives inside the agent's working directory, so an agent allowed to edit files, or a `git pull`, could otherwise turn a file write into code execution outside the harness's permission system. Trust is therefore given to a **content hash** of the plugin directory, not to the repo: any change leaves the previous trusted version running and asks again, showing the diff. An agent iterating on a plugin without a prompt per edit works in `~/.ivin/plugins/`, which is outside its working directory and so behind an approval.

### Loading

- The server compiles `server.ts` and `ui.tsx` with Rolldown on load (cached by content hash in `~/.ivin/cache/plugins`), and hands the server bundle to the plugin host.
- `react`, `react-dom` and `@ivin/plugin-api` (with its subpaths) are externals provided by the host (import map in the renderer, module aliases in the plugin host), so there is exactly one React instance.
- Each half exports `activate(ctx)`; everything it registers through `ctx` is disposed automatically on deactivate. `ctx.signal` (an `AbortSignal`), `ctx.setInterval` and `ctx.exec` cover timers and child processes; what a plugin starts outside `ctx` lives until the next plugin host restart.
- Every `ctx` call in a server half crosses a process boundary, so the whole server API is asynchronous.
- **Hot reload**: a watcher on each plugin directory recompiles on change, deactivates the old version, then imports the new one with a hash in its URL. Reload takes well under a second, so an agent can edit, reload and look in one loop. Old module versions stay in the ESM cache; the plugin host is restarted when idle once enough have piled up.
- Rolldown doesn't type-check. `ivin plugin check <id>` runs the type checker against the plugin's `tsconfig.json`, and a reload reports type errors in `ivin plugin logs` without blocking the load.
- **Until the plugin host milestone**, built-in plugins are plain workspace modules imported statically and built with the app: same `activate(ctx)` shape and same `ctx`, no runtime loading. They move to the dynamic path when it exists.
- **What exists so far** of that path: the UI halves of user plugins (`~/.ivin/plugins/`). When the window starts, `plugin.list` has the server compile each one with Rolldown into `~/.ivin/cache/plugins/<hash of the plugin's files>.js`; the desktop app serves that folder as `ivin-plugin-bundle://cache/<file>`, and the window imports the bundle and activates it beside the built-in plugins, replacing the built-in plugin with the same `id` only once its `activate` returns; if it throws, the built-in stays. A host module resolves to a CommonJS module that reads the window's instance from `globalThis.__ivinHostModules`, so a bundle holds no copy of React, nor does any dependency's import of it. A plugin's `dependencies` are installed first, from its `pnpm-lock.yaml`, by the pnpm ivin ships, into `~/.ivin/cache/plugins/deps/` ([ADR-0008](../adr/0008-plugin-dependencies-are-installed-by-the-pnpm-ivin-ships.md)); `ivin plugin lock <id>` writes that lockfile. Any other package import fails the compile, and `plugin.list` streams each plugin as soon as it is ready, so an install never holds up the others. A failed manifest, compile, import or activation is written to `~/.ivin/logs/plugins/<id>.log`, read by `ivin plugin logs <id>`. Not there yet: the plugin host and server halves, hot reload, project plugins, safe mode. Rolldown's native binding and pnpm ship beside the server bundle, outside the asar archive.

### Error isolation

What is contained, and by what:

| Failure | Containment |
|---|---|
| Server half throws, or rejects a promise | caught in the plugin host, logged against the plugin, handler skipped |
| Server half loops or blocks | the host misses the server's heartbeat; the server kills it, restarts it, and disables the plugin whose handler was running |
| Server half crashes the host | same restart; sessions and agents are untouched, they live in the server |
| Plugin fails to activate | marked failed and logged once; a user plugin that replaces a built-in leaves the built-in active, and stays off until its bundle changes or the window reloads |
| UI contribution throws while rendering | its own error boundary shows "plugin `prs` failed — see `ivin plugin logs prs`" in place of the slot, and the error is written to the plugin's log |
| UI editor extension is invalid, or a file icon function throws | the extension is checked once with `EditorState.create` when the plugin adds it, and each icon function is wrapped; the faulty one is turned off and reported to the plugin's log, and files open and icons draw without it |
| Core UI throws while rendering | a boundary inside `RegistryProvider` shows the window's failure message with Retry and Reload window; Retry keeps every atom, so drafts and unsaved edits stay. A boundary around the session and file area, reset on a tab switch, shows the same message there while the sidebar keeps working. Both write the error to `ivin logs` |
| UI contribution throws in an event handler or async code | caught by a window-level handler: an error from a user plugin's bundle (found by its bundle URL) or from a plugin's command (a built-in plugin's too) is written to that plugin's log and the plugin stays on; any other error goes to `ivin logs` |
| UI contribution blocks or loops the renderer | not containable in-process. Main sees the window unresponsive, reloads it with the plugins activated or reloaded last disabled, and says which |

**Safe mode** is the recovery of last resort: main records each launch, and after a crash or hang during startup the next launch disables user and project plugins and reports it. `ivin --safe` forces it, and `ivin plugin disable <id>` works from the CLI even when the window is unusable.

`console` output and errors are captured per plugin and readable through `ivin plugin logs <id>`, so the agent that wrote the plugin can debug it.

No sandbox in v1: plugins are local code chosen by the user, as in VS Code or Obsidian. The plugin host isolates failures, not permissions.

A manifest's `permissions` list the `ctx` calls a server half may make, and ivin refuses the others; they never limit the plugin's code ([ADR-0011](../adr/0011-a-plugin-declares-the-harness-exec-and-fetch-calls-it-makes.md)). Built so far: the manifest reading (`plugin/rules/manifest.ts`) and the check (`plugin/rules/permissions.ts`). Not enforced yet: `ctx` for server halves, `ctx.fetch` and the trust prompt wait for the plugin host. The built-in plugins have UI halves only and declare none.

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

Plugins contribute React components to named **slots**. A slot receives typed props and renders every contribution in `order`; a contribution can declare `replaces` to take over a built-in one (e.g. a custom renderer for `Bash` tool calls). When several plugins replace the same contribution, the replaced contribution stays hidden and every plugin that replaces it renders, in `order`; ivin picks none.

A contribution is named `<plugin id>/<name>` (`name` defaults to the slot name), and `replaces` holds that id. A `transcript.toolCall` contribution declares the tool it renders with `tool: "Bash"`, and one without `tool` matches every tool. Every matching contribution renders unless another shown one replaces it, so a `Bash` renderer sets `replaces: "tool-calls/default"`. Thinking has no slot: it goes through `transcript.message`. The host passes the hooks to `@ivin/plugin-api` through a provider (`UiHostProvider`), implemented over the UI's atoms, so the package never imports the UI. Which parts of the window are the app's frame and which are contributions is in [ADR-0009](../adr/0009-the-window-frame-stays-in-the-app-and-its-features-are-plugins.md).

Transcript slots render inside a virtualised list and once per item, so they receive transcript items, not raw events, and must stay cheap.

| Slot | Props | Used for |
|---|---|---|
| `transcript.message` | item, session id | custom message rendering, skill highlights |
| `transcript.toolCall` | tool call item (call, result, status), session id; matched by tool name | expandable commands, logs pill, subagent details |
| `transcript.inline` | markdown node | inline code links, issue mentions |
| `transcript.approval` | approval item (tool, input, decision), session id | allow or deny a tool the agent asks to run |
| `transcript.question` | question item (questions, status, answers), session id | the questions the agent asked and the answers given |
| `session.composer` | session id; mounted again for each session | the composer under the transcript (built in, `composer/composer`), which renders `composer.above` and `composer.status` itself |
| `composer.status` | session id | tokens, cost, branch PR |
| `composer.above` | session, `isEmptyComposer(target)` (lets a sheet take keys from the empty composer) | approval sheet (built in, `approvals/sheet`), question sheet (built in, `questions/sheet`), queued messages, detail sheets; an attention sheet squares the composer's top corners and dashes its top border |
| `composer.suggest` | trigger char, query | `#` issues, `@../` paths, `/` commands |
| `session.badge` | session | linked PR/issue icon in the sidebar and tabs |
| `session.card` | session | hover card sections |
| `sidebar.section` | — | Inactive sessions, custom sections; rendered by the Sessions panel under the selected project's sessions |
| `sidebar.bottom` | — | Working panel; a panel across the bottom of the sidebar card, under the rail and the sessions, that the user resizes |
| `sidebar.panel` | — | a tab of the sidebar's list column, named by the contribution's `title`, with its `badge` component after the name: Sessions (built in, `sessions/panel`, first by its `order` of -1), Files (built in, `files/panel`), Changes (built in, `changes/panel`, its count as the badge). The tab the user picked is kept by contribution id; a picked panel that another replaces shows its replacement, and one that is gone shows the first tab |
| `window.overlay` | — | mounted once in the window while a project is open, for a popup a command opens: Go to file (built in, `files/goToFile`) |
| `tab.decoration` | tab | git status colour, session icon |
| `view` | params | a full tab view |
| `settings.section` | — | a plugin's settings page (generated from the manifest's `settings` when absent) |

Plus non-visual contributions: `commands` (command palette), `keybindings`, `themes`, `fileIcons`, `editorExtensions`, `fileOpeners` (HTML preview, not built yet).

`ctx.fileIcons.add((row) => icon)` gives the `Tree`'s rows their icons ([ADR-0007](../adr/0007-the-file-tree-is-headless-tree-on-tanstack-virtual.md)): given a row's name, whether it is a folder and whether it is open, the function returns a React node, or null to leave the row to the next function, then to the `Tree`'s own icon. The functions are tried in the order the plugins added them, and the `Tree` draws the first icon given, an `<img>` at `--iv-tree-icon-size`. The built-in `file-icons` plugin gives them from a VS Code file icon theme, Gruvbox Material Icons, which it ships in its folder. With the `files.folderIcons` setting off, the `Tree` asks no function for a folder's icon and draws none.

`ctx.fileUrl(path)` is the URL of a file of the plugin's own folder, for an `<img>`: `ivin-plugin://<plugin id>/<path>`, which the desktop app serves from that folder, as it serves sent images ([ADR-0005](../adr/0005-sent-images-are-files-served-to-the-window-by-the-desktop-app.md)). It refuses a path that leads out of the plugin's folder, through `..` or a symlink. The built-in plugins' folders ship in the app's resources, their code left out.

`ctx.editorExtensions.add(extension)` adds a CodeMirror extension to the editor of every open file, after the core's: to take a key the core binds, a plugin wraps its keymap in `Prec.highest`. A plugin builds it from `@ivin/plugin-api/editor`, which re-exports the host's `@codemirror/state` and `@codemirror/view`: a second copy of CodeMirror would not recognise the host's extensions.

A failure with no place on screen is a notification: `notify({ kind?, message, action? })` (`kind` is `error` by default, or `warning`, `info`, `success`), and `ctx.notify` for a plugin. A command handler that fails with no place for its failure throws a `CommandFailure(message, retry?)`; `runCommand` shows it as a notification with Retry, and shows any other error as "<command title> failed." and lets it reach the log. The core's `session.archive` is the first: the failure it records for the session's row shows in a menu that is closed when the key is pressed. The stack is drawn in the session's chat, above the composer ([DESIGN.md](../../DESIGN.md#notification)).

A plugin's command opens its own sidebar tab with `ctx.sidebar.showPanel(name)`, which also shows a hidden sidebar and puts the focus in the tab's panel. A UI command and its default keybinding are declared with `ctx.commands.register("prs.refresh", { title, run })` and `ctx.keybindings.add({ key: "mod+r", command: "prs.refresh", when: "sessionList" })`. The core lists its own commands and default keybindings in the `command` and `keybinding` modules, and a mounted component runs a core command that needs its state (the composer runs `composer.send`). One keyboard handler on the window finds the keybinding for a key: an area is an element marked `data-keybinding-area="<name>"`, the areas around the focus are tried from the closest out, then the keybindings with no area. It ignores a key a control already used (`defaultPrevented`) or an input method is composing. The server watches `~/.ivin/keybindings.json` and streams it (`keybinding.watch`); the UI merges it over the defaults ([ADR-0003](../adr/0003-keyboard-shortcuts-are-keybindings-to-commands.md)).

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

Hooks available to plugin components: `useSession`, `useSessions` (every open project's, each with its harness, its status and when that status began), `useProjects` (the open projects and the selected one), `useSelectedSessionId` (the session on screen), `useTabs` (the selected project's), `useSessionListStatus` (whether the selected project's tabs have loaded, whether its tabs or sessions failed to, and a retry), `useOpenTab` (selects the session's project too), `usePendingApproval` and `usePendingQuestion` (the approval or the questions the session waits on, re-rendering only when that item changes), `useUsage` (the session's tokens and cost, summed by the server over the whole session), `useSessionActions` (Archive and Delete for a session's menu, and the last of them that failed), `useListFolder` (one level of a folder of a session's working folder, through `file.listFolder`, or the message for why it failed), `useOpenFile` (opens a file of the session's working folder beside its chat as a sub-view, or the failure), `useListFiles` (every file of the working folder that git does not ignore, through `file.listFiles`, or the failure), `useFolderChanges` (runs a callback with each batch of paths `file.watch` streams while mounted), `useGitStatus` (the working folder's changed files, through `file.gitStatus`, read again after each change on disk, with the message for why it failed and a retry; `file.listFiles` and `file.gitStatus` fail with `GitFailed` when git cannot read the repository), `useFileOnScreen` (the file the session's tab has selected beside its chat), `useSettings` (the user's settings over the defaults, kept up to date with `settings.json`), `useChanges(sessionId, kind)` (the working folder's changes, listed again after each change on disk, with a retry after a failure: `"working"` for the uncommitted ones, through `file.listChanges`, `"committed"` for what the commits of the session's branch changed since it left `origin/<default branch>`, through `file.listCommittedChanges`), `useOpenDiff` (opens a file's diff of either kind beside the session's chat as a sub-view, or the failure), `useDiffOnScreen` (the path and kind of the diff the session's tab has selected), `useDiscardChanges` (discards uncommitted changes through `file.discardChanges`, or the failure with git's output), `useAnnotations`, `useAnswerApproval` and `useAnswerQuestion` (answer an open approval or question of a session, or return the failure), plus the design system components (`Button`, `IconButton`, `Icon`, `Menu`, `Dialog`, `Tooltip`, `Text`, `Stack`, `Block`, `Disclosure`, `CodeBlock`, `StatusMark`, `Markdown` (given a `sessionId`, its file links and the paths written in its inline code open beside that session's chat), `FilePath` (a path that opens its file beside a session's chat the same way, for a plugin that shows a path outside an answer), `ActionSheet` (with an `aside` in its title row and a footer of key hints and actions), `KeyHints` (a row of keys, each with its action), `OptionList`, `ChoiceList` (radio buttons or check boxes with descriptions, numbered, and an optional last option answered in the user's own words), `Steps`, `ListRow`, `ListSection` (its label can be left to screen readers), `SessionMark` (it takes the session's harness, its status and, while it waits, what it waits on), `RelativeTime`, `ProjectMark`, `Tree` (on headless-tree and TanStack Virtual, [ADR-0007](../adr/0007-the-file-tree-is-headless-tree-on-tanstack-virtual.md): VS Code's explorer selection and keys, each key a command in the `tree` area; the plugin gives it the rows, opens folders when asked and opens files on `onOpen`; a row may carry its git status and the part of its name that matched, and `revealId` selects a row and scrolls to it), `ChangeList` (groups of changed files under a heading that folds them, each row with its file icon, status letter and line counts, a Discard button on hover and a Discard all button on the heading, one tab stop moved through with the arrow keys, a keybinding area for the plugin's commands and the focused row reported to it; a group names its Discard commands, whose keys the row, the heading and the buttons' tooltips show), `SearchField`, `QuickPick` (a field over a list of choices in a popup at the top of the window)) and the helper `formatToolInput`, so plugins look native; the host supplies them, so a plugin never imports a UI library ([ADR-0002](../adr/0002-design-system-on-base-ui-and-css-custom-properties.md)). The package declares the types of all of these itself, in `types.ts`, and imports nothing from `@ivin/contracts`; the host passes the contracts' objects and a type test in the UI package keeps the two in step ([ADR-0014](../adr/0014-the-plugin-api-declares-its-own-types-and-one-hook-per-piece-of-data.md)).

### Plugins building on plugins

Plugins share through four soft channels; none makes a plugin fail when another is absent:

- **Annotations.** A kind shared by several plugins has its `data` shape defined in `contracts`, `pr` first. Whoever writes it and whoever renders it need not know each other.
- **Slots defined by a plugin.** `ctx.slots.define("prs.card.section")` opens a slot prefixed with the plugin's id. Contributions to a slot nobody defines never render.
- **Commands with a result.** `ctx.commands.run("github.refresh", args)` calls another plugin's command and returns its result, or fails with an "unknown command" error. These calls are untyped across plugins.
- **Core services**, for what no forge or tool owns: git, the account a project uses on a host, `ctx.poll`, `ctx.exec`.

The core knows no forge. GitHub is a built-in plugin (`github`: PR detection and polling with `gh`, `#` issue mentions) that writes `pr` annotations, and the `prs` plugin renders them. A GitLab plugin writing the same annotations gets the same UI.

Plugins declare no dependency on each other: that would bring load order, cascading reloads and an API version per plugin. It can come later as an optional manifest field, without breaking existing plugins, when a real feature needs typed calls into another plugin.

### API stability

The plugin API version a plugin is built for is the range of `peerDependencies["@ivin/plugin-api"]` in its `package.json`. It stays at `^0` until the fork is replaced (milestone 4): the API breaks freely while fork features are ported, and built-in plugins are fixed in the same commit. `@ivin/plugin-api` 1.0.0 is published at the switch; from then on the host refuses a plugin built for a newer major and warns on an older one. Built-in plugins declare the current major, so any breaking change shows up in our own code first.

## Agent-facing surface

### Files

```
~/.ivin/
  settings.json        JSONC, watched
  keybindings.json     watched, key → command, see ADR-0003
  logs/ivin.log        raw errors from the server and the UI, see ADR-0004
  themes/<id>.json     colours + CSS overriding the `--iv-` variables; filename is the id
  plugins/<id>/
  cache/plugins/       compiled bundles, by content hash
  run/ivin.sock
<repo>/.ivin/
  settings.json        project settings (on-save commands…)
  plugins/<id>/
```

Writes go through a temp file and a rename, so the app never reads a half-written file. An invalid file keeps the last valid version and reports the parse error (`ivin doctor`).

The server reads `settings.json` and streams it (`setting.watch`). `setting.get` reads a setting at a dotted path, and `setting.set` checks the path and the value against the `Settings` schema (its type, or for a setting with fixed values one of them, which a refusal lists), then edits that one value in place (through `jsonc-parser`), keeping the file's comments and layout; it refuses a file it cannot parse rather than rewrite it. Its settings so far, with their defaults:

```jsonc
{
  "tabs": { "stopAgentOnClose": true },
  "worktrees": { "removeOnTabClose": true },
  "files": { "folderIcons": true },
  "sidebar": { "layout": "rail" }, // or "strip"
  "agents": { "stopWhenIdleMinutes": 10 }, // 0 keeps idle agents running
  // automaticCheck false: no check until Check for updates is run.
  // beta: the newest release, beta or not; on by default when the installed version is a beta.
  "updates": { "automaticCheck": true, "beta": false },
}
```

The settings page shows the streamed settings and writes a change through `setting.set`, as `ivin settings set` does. Each setting's label and description sit beside the `Settings` schema, in `settingSections` in `contracts`, and a test fails when a setting has none. The page opens `settings.json` in the system's app for JSON files through the desktop app (`window.ivin.openSettingsFile`), which first creates the file when it is missing.

### CLI

```
ivin session annotate --kind pr --data '{"url":"…","relation":"referenced"}'
ivin session rename <title>                             # the agent names its session's work
ivin link <url> --as <relation>                         # sugar over annotate, for a pr or an issue
ivin theme set <id> | ivin theme list
ivin settings get|set <path> [value]
ivin plugin list | reload <id> | logs <id> | lock <id> | new <id>
ivin plugin check <id>                                  # type-check against the plugin API
ivin plugin enable|disable <id>
ivin run <command> [--args json]                        # any plugin command
ivin logs                                               # raw errors of the server and the UI, ADR-0004
ivin doctor
ivin --safe                                             # start with user and project plugins disabled
```

Commands default to `$IVIN_SESSION_ID`, so an agent annotates its own session without knowing its id.

Shipped so far:

- `ivin doctor`, one line per check (the app's version, the socket, `settings.json`, `keybindings.json`, the program the harness runs, found on the server's `PATH`, and the install of the `ivin-customize` skill), exit 1 when one fails.
- `ivin session annotate --kind <kind> --data <json> [--ns <ns>] [--session <id>]`: `ns` defaults to `cli`, the session to `$IVIN_SESSION_ID`; with neither, or with invalid JSON or data that does not fit a defined kind, it exits 2. `--json` prints the stored annotation.
- `ivin link <url> --as <relation> [--session <id>]`: writes a `pr` or an `issue` annotation in the `cli` namespace, with the same session default; the URL decides which. It must be a GitHub pull request or issue (`…/<owner>/<repo>/pull/<n>`, `…/issues/<n>`) or a GitLab merge request or issue (`…/<group>/<project>/-/merge_requests/<n>`, `…/-/issues/<n>`) on any host; what follows the number is dropped and the path lowercased, so `…/pull/1/files` links the same pull request as `…/pull/1`. Another URL, or a relation the kind does not take, exits 2.
- `ivin session rename <title> [--session <id>]`: sets the session's title, with the same session default, as the agent's rename. A blank title, or no session, exits 2; an unknown session, or one the user renamed, exits 1 and leaves the title as it is. `--json` prints `{ ok, title }`.
- `ivin plugin lock <id>`: writes the plugin's `pnpm-lock.yaml` from the `dependencies` of its `package.json`, keeping the versions its current lockfile holds. An unknown id, or a failed resolution, exits 1.
- `ivin plugin logs <id>`: the plugin's failures, oldest first, one per line with its time, from `~/.ivin/logs/plugins/<id>.log`; `--json` prints `{ id, lines }`. A missing id exits 2.
- `ivin settings get [path]`: the settings in use, one `path = value` line each, or the value at a dotted path; `--json` prints `{ path, value }`.
- `ivin settings set <path> <value>`: the value is read as JSON, else as a string. An unknown path (it lists the known ones), a value of the wrong type, or a `settings.json` that does not parse exits 1 and leaves the file as it is. A missing file is created holding only that value.

- **Running it.** `apps/cli` is bundled by tsdown into one file, shipped as `Resources/cli/ivin.js`. At each launch main writes `<userData>/bin/ivin`, a shell script that runs that file with the app's own Electron as Node (`ELECTRON_RUN_AS_NODE=1`), so `ivin` needs no Node and follows the app when it moves.
- **In the user's shell.** The settings page's Command line section (or the `cli.installInShell` command) asks the server to link `ivin` into the user's shell: main passes the script's path as `--cli-command`, and `cli.installInShell` puts a symlink to it in `/usr/local/bin` when ivin can write there, else in `~/.local/bin`, creating that folder, without asking for admin rights. Installing again replaces ivin's own link (a link to that script), and an `ivin` there that is anything else is left alone and reported (`ShellCommandNotOurs`). With neither folder writable it fails naming each one and why (`ShellFoldersRefused`). `cli.getShellInstall` finds the link, and says whether its folder is on the `PATH` of the user's login shell (`$SHELL -ilc`, 5 s at most), since an app opened from the Dock does not get that `PATH`.
- **Every command** takes `--help` and `--json` (stdout gets `{ "ok": …, … }`, or `{ "ok": false, "error": { "reason", "message" } }`), and exits 0 (ok), 1 (failed), 2 (invalid usage) or 3 (ivin is not running). It reaches `$IVIN_SOCKET`, else `~/.ivin/run/ivin.sock`. The CLI writes its own messages; the raw error stays in the server's log ([ADR-0004](../adr/0004-the-ui-writes-error-messages-and-the-server-logs-raw-errors.md)).
- **Time limit.** A command exits 1 with "ivin did not answer within N s" when the app has not answered after 30 s (5 minutes for `plugin lock`), also when it accepted the connection and never answers.
- **The socket.** The server removes it on a clean exit. At start it replaces one nobody answers on, left by a crash, and leaves alone one another running ivin answers on: that launch then serves no socket, logs why, and gives its agents an empty `IVIN_SOCKET`, so their `ivin` says so instead of reaching the other app.
- **What the socket serves.** Only the RPCs the `ivin` commands call, listed in `CliSocketRpcs` (`packages/contracts/src/rpcs.ts`), since every agent can reach the socket: a new command adds its RPC there. The server drops a line that is not JSON and closes a connection that sends more than 1 MiB without a newline.
- **Tests** run the built `ivin` as a child process against an in-process server on a temporary socket with an in-memory SQLite (`apps/server/src/rpc/cli-server.ts`).

### Skills and docs for agents

The app ships two skills, installed into supported harnesses at launch: `ivin-customize` (files, CLI, themes) and `ivin-plugin` (plugin format, API reference, slot list, the edit → `plugin check` → reload → `plugin logs` loop). `@ivin/plugin-api` types are the API reference; each built-in plugin is a worked example.

Shipped so far: `ivin-customize` (the CLI, when to link a pull request or an issue, the settings file), kept in `apps/server/skills/` and shipped as `Resources/skills/`. `ivin-plugin` waits for the plugin host.

- **Where.** The harness names the folder it reads the user's skills from (`skillsFolder` on the `HarnessProvider` port): Claude's is `$CLAUDE_CONFIG_DIR/skills`, else `~/.claude/skills`. A harness with none gets no skill.
- **When.** At each launch, before serving, the server copies the skill there when its folder is absent, or when ivin wrote it (a `.installed-by-ivin` marker file holding a hash of the skill's files) and the bundled skill's hash differs. A folder of that name without the marker is the user's and is left as it is. The copy goes to a hidden folder beside it, then is renamed into place, so a crash never leaves a half-written skill; the next launch removes what a crash left.
- **Report.** The result (installed, updated, up to date, not ivin's, or failed, with the folder) is logged, a failure's raw error in `ivin.log`, and shown by `ivin doctor`; only a failure fails its check.

### MCP, later

Once the CLI is stable, an optional `ivin` MCP server can expose the same commands (no shell per call, structured results), injected through `harness.beforeSpawn` with an allowlist. It wraps the RPC layer; it never becomes the only way in.

## Example: session PRs

The feature that started this design, as two plugins: `github` knows the forge, `prs` shows pull requests whatever the forge.

- `github`'s `server.ts` watches `transcript.onEvent` for a `gh pr create` or GitHub MCP `create_pull_request` result holding a PR URL, and adds a `pr` annotation with `relation: "created"`. Deterministic, free, no agent cooperation needed.
- `github` turns the `citation` the server stores from a session's first message into an `issue` or `pr` annotation with `relation: "referenced"`, on the project's GitHub remote, asking `gh` whether the number is an issue or a pull request.
- The agent adds what detection can't see with `ivin link <url> --as referenced`; the `ivin-customize` skill tells it when.
- `github` polls each open PR's state, CI and mergeability with `ctx.poll` and `ctx.exec("gh", …)`, and updates the annotation.
- `prs`'s `ui.tsx` reads the `pr` annotations and fills `session.badge` (state icon, CI chip, `+n`), `session.card` (folded PR list) and `tab.decoration`.

In the fork this took hooks in 10 upstream files; here it touches no core file.

## Porting the MonoCode fork

The fork's `docs/fork/` entries are the backlog. Each feature becomes a built-in plugin unless it is core behaviour.

This table lists what the fork added, not what it sits on. The base app MonoCode provides (editor, file explorer, diff, git, worktrees, tabs, terminal, three harnesses) has to be rebuilt too, and is the larger part of the work; the milestones are ordered around it.

| Area | Fork features | Extension points |
|---|---|---|
| Core (not plugins) | worktree adoption, default-branch start, steer delivery, background tasks, stop on tab close, worktree cleanup, git spawn perf, dev builds | harness layer, session lifecycle |
| Transcript | expandable commands, background command logs, subagent detail sheet, sent skill highlight, inline code links, inline images, image gallery, user bubble | `transcript.*`, `composer.above`, themes |
| Composer | approval sheet, double Escape clear, `/clear`, Claude native commands, `#` issue mentions, `@../` mentions, status line | `composer.*`, `commands`, `keybindings` |
| Sessions & GitHub | branch PR link, multiple PRs, title-tab session card, GitHub account per project | `session.badge`, `session.card`, `tab.decoration`, annotations, `harness.beforeSpawn` (env `GH_TOKEN`) |
| Sidebar & layout | inactive sessions, Working panel, Monos collapse, stacked side panels, swap side panels, session sub-tabs, dock follows session | `sidebar.*`, `view`, layout API |
| Files & editor | explorer reveal and toolbar, code fonts, VS Code keys, tsgo navigation, HTML preview, tab git status, worktree icons, branch picker fetch and worktrees, code workspaces, project on-save commands | `editorExtensions`, `fileOpeners`, `fileIcons`, `tab.decoration`, project settings |
| Look | Gruvbox theme, tab dividers | `themes`, `fileIcons` |

### Window shell

The sidebar is a floating card inset from the window edges: a header row (macOS traffic lights, a sidebar toggle on ⌘\, back and forward over the sessions opened in this window, kept in memory), then a body split into a project rail and the list column. The rail has one button per open project in their order (its creature, with the count of sessions waiting on the user), the open-folder button (native folder dialog) right after them, and the Settings button and the connection status at its bottom. The list column has a head with the selected project's name, New session, and a menu with Archived sessions and Close project; Archived sessions (or `session.showArchived`, ⇧⌘A) replaces the column with the project's archived sessions, each restored or deleted from its row, until its back button or Escape. Under the head, a row of tabs: Sessions (`sidebar.showSessions`, ⌘1), then one tab per `sidebar.panel` contribution, such as Files (`files.show`, ⌘2); the selected tab is kept between launches. Sessions lists the project's sessions that have an open tab, in tab order, then the `sidebar.section` contributions, such as the folded "Inactive sessions". Files shows a tree of the working folder of the session on screen and follows it when another session comes on screen: folders open one level at a time, each listed by `file.listFolder`, which flags what git ignores (shown only while the user asks), leaves out the `.git` folder, and refuses a path that leads out of the working folder, through `..` or a symlink. The tree lists a folder again when `file.watch` reports a change in it, colours rows by `file.gitStatus`, opens the folders of the file on screen and selects it, and a filter field narrows it to the files of `file.listFiles` whose name holds the text. Go to file (`files.goToFile`, ⌘P) ranks the same list by the letters typed and opens the chosen file. Across the bottom of the card, under the rail and the list column, the `sidebar.bottom` contributions: the "Working" panel, listing the sessions of every open project that wait for an approval or an answer ("Needs you", each with its command and Allow and Deny, or its first question) or run ("Running"), except the one on screen. The card's width and the bottom panel's height are resized by drag and kept between launches. The main area sits on the plain app background; the slim top bar is the selected project's tab bar, where each tab shows its session's title and state, has a close button for the mouse, and reorders by drag or with `tab.moveLeft` and `tab.moveRight`; `tab.close` closes the selected one; a right click on a tab opens the session's Archive and Delete. A session row's menu holds Rename, Archive and Delete, and `session.archive` (⇧⌘⌫) archives the session on screen. Archiving a working or waiting session, and any delete, ask first in a dialog; a failed archive, restore or delete shows its message under the session's row. Under it the selected tab shows its session (transcript and composer); a project with no tab shows an empty message. With the card hidden, the toggle and arrows move to the top left of the main bar.

A project is a pixel creature (8x8, mirrored, generated from its name, one of six `--iv-project-hue-*` hues). A session row is the mark of the session's harness with a status overlay; a project button shows how many of its sessions wait on the user, and a session waiting on the user is outlined. Each harness mark keeps its brand colour, the one colour outside the tokens; a harness with no mark of its own shows a neutral agent mark.

The status line under the composer and each sidebar session row show the session's branch, with a checkout or worktree icon. A session with no message yet shows its composer in the middle of the window, under "What should we work on in <project>?"; the status line then opens a menu to pick Current checkout, New worktree or one of the project's worktrees. A session whose worktree was deleted shows its struck branch and "deleted" there, and its composer is replaced by the question "Where should the agent continue?" with the same three choices.

Designs decided but not built yet are listed under "Pending designs" in [`DESIGN.md`](../../DESIGN.md).

Layout features (stacked or swapped panels, sub-tabs) are where the slot model is weakest; expect to grow a small layout API (`ctx.layout.registerPanel`, panel placement settings) while porting them.

## Build and release

- **One version.** The whole monorepo carries a single semver version, `0.x` until the switch. The plugin API's version, `@ivin/plugin-api`'s, is separate and does not follow it.
- **Packaging.** electron-builder, macOS arm64 only at first; CI also builds a Linux x64 folder that only the end-to-end tests use. `node-pty` is the one native module: it is rebuilt for Electron and unpacked from the asar archive.
- **Releases** ([ADR-0013](../adr/0013-releases-are-unsigned-and-published-by-a-workflow-started-by-hand.md)). A workflow started by hand (`release.yml`), on the stable or the beta channel, runs release-it, which bumps the version from the conventional commits, writes `CHANGELOG.md` and tags `vX.Y.Z` (`vX.Y.Z-beta.N` for a beta), then builds the unsigned macOS arm64 app and publishes it as a GitHub Release, a pre-release for a beta. The app reports the monorepo's version.
- **Updates** (how it works: Updating the app, under Processes). The app reads the manifest and the zip of the latest release itself. `electron-updater` is out: macOS auto-update needs a signed app, so an Apple Developer ID, which would reopen the choice.
- **Packaged early.** CI builds the packaged app and launches it from milestone 1 on, because `utilityProcess` paths, the asar archive and the native module only fail there.

## Milestones

1. **Skeleton**: Electron + server process + RPC, one project, Claude harness, transcript view, composer, SQLite. Slot renderer and `activate(ctx)` in place, with built-in plugins imported statically. A packaged build that launches, checked in CI.
2. **Daily driver, narrow path**: Claude only. Worktrees, tabs, sidebar, files, diff, terminal. The fork features used every day, each as a static built-in plugin, session PRs first. `ivin` CLI with `session annotate`, `settings`, `theme`. The plugin API takes its shape here, at `@ivin/plugin-api` 0.x. Signed releases and auto-update.
3. **Plugin host**: plugin host process, manifest, Rolldown loading, hot reload, error isolation, safe mode, content-hash trust, logs, `ivin plugin …`. Built-in plugins move to the dynamic path.
4. **Switch**: Codex and ACP harnesses; port the rest from `docs/fork/` as needed; stop adding features to the fork; freeze the plugin API as `@ivin/plugin-api` 1.0.0.
5. **Later**: MCP wrapper, headless server for remote and mobile, plugin sharing.

## Open questions

- Terminal emulator, to settle at milestone 2: xterm.js, or `libghostty-vt` compiled to WASM (e.g. `ghostty-web`, which keeps the xterm.js API, so the swap is cheap either way). The PTY lives in the server (`node-pty`) and only speaks bytes over RPC, so the choice stays local to one UI component. The full libghostty with its native renderer is out: a Metal surface doesn't compose inside a Chromium window.
- Evolving stored data. Owning the transcript means a change to an event's shape meets events already stored. The SQLite schema moves by numbered, forward-only migrations, run at server start in one transaction and recorded in the database; a server that finds a newer schema than it knows refuses to start. Still to settle: a version on transcript events and annotations, and whether old ones are rewritten or upcast on read.
