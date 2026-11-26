---
name: ivin-plugin
description: Write, change or debug an ivin plugin: a TypeScript folder in `~/.ivin/plugins/` that adds to ivin's window (the app this session runs in) or runs code beside it. Use when the user asks to add a panel, a command, a keybinding, a file icon or an editor extension to ivin, to change what a plugin of theirs does, or when `ivin plugin logs` or `ivin plugin check` reports a problem.
---

# Writing an ivin plugin

A plugin is a folder in `~/.ivin/plugins/<folder>/`. ivin compiles it when it loads and again each time a file in it changes, with no build step and no window reload: the window keeps its open tabs and drafts.

## The loop

1. `ivin plugin new <id>` creates the folder with a working plugin (skip it to change an existing plugin). `<id>` is lowercase letters, digits and dashes.
2. Edit the files. ivin reloads the plugin by itself within a second.
3. `ivin plugin check <id>` prints the type errors, `file(line,column): error TSxxxx: message`, and exits 1 when there is one. A type error does not stop the plugin from loading, so run it after each edit.
4. `ivin plugin logs <id>` prints what the plugin logged: its `console` output, an error it threw, a compile error, a type error found by a reload. Oldest first, each with its time.
5. `ivin plugin reload <id>` forces a reload when you need one without an edit. `ivin plugin list` shows each half as `active`, `failed`, `disabled` (ivin stopped it for blocking the plugin host) or `none`.

Every command takes `--json`. A failed compile keeps the previous version running: read the log to see why the new one did not load.

## The files

```
package.json    the manifest is its `ivin` key
tsconfig.json   written by `ivin plugin new`; resolves `@ivin/plugin-api` to ivin's types
README.md       what the plugin does, for the next agent that edits it
src/ui.tsx      the UI half, runs in the window
src/server.ts   the server half, runs in the plugin host process
```

```json
{
  "name": "ivin-plugin-demo",
  "ivin": { "id": "demo", "name": "Demo", "ui": "src/ui.tsx", "server": "src/server.ts" }
}
```

`ivin.id` and at least one of `ivin.ui` and `ivin.server` are required. A plugin with the id of a built-in plugin replaces it. Further `ivin` keys: `settings` (each setting has a `type` of `boolean`, `number` or `string`, a `default`, a `title` and a `description`; read and written with `ivin settings`, as `<id>.<key>`) `views` (see "Views") and `permissions` (see "Permissions").

Imports: relative files, `react`, `react-dom`, `@ivin/plugin-api/ui`, `@ivin/plugin-api/server` and `@ivin/plugin-api/editor` are the only ones that need nothing. Any other package goes under `dependencies` in `package.json`, then `ivin plugin lock <id>` writes the `pnpm-lock.yaml` ivin installs from; a plugin with dependencies loads only with a lockfile that matches them. Run it after each change to the dependencies. The plugin's own sources go in `src/`; put one component per file in `src/ui/`, one hook per file in `src/hooks/` and pure logic in `src/rules/`, and keep `ui.tsx` to `activate`.

## The UI half

```tsx
import { defineUi } from "@ivin/plugin-api/ui"

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.bottom", Hello)
  ctx.commands.register("demo.hello", { title: "Say hello", run: () => ctx.notify({ kind: "info", message: "Hello" }) })
  ctx.keybindings.add({ key: "mod+shift+h", command: "demo.hello" })
})
```

`activate(ctx)` registers everything the plugin adds, right away. A reload removes what the old version registered before the new one registers its own. Heavy code (a panel, an overlay) goes in another file loaded with `import()` from the slot's component.

- `ctx.slots.add(slot, Component, { order, name, replaces, tool, title, badge })`: a React component for a slot. A contribution is named `<id>/<name>`; `replaces` takes over a built-in one (a `transcript.toolCall` renderer for `Bash` sets `tool: "Bash"` and `replaces: "tool-calls/default"`).
- Slots: `transcript.message`, `transcript.toolCall`, `transcript.approval`, `transcript.question` (transcript items, rendered once per item: keep them cheap), `session.composer`, `composer.status`, `composer.above`, `sidebar.section`, `sidebar.bottom`, `sidebar.panel` (a tab of the sidebar, named by `title`), `window.overlay`, `settings.section`.
- `ctx.commands.register(id, { title, run })`, `ctx.keybindings.add({ key, command, when? })`, `ctx.notify({ kind?, message, action? })`, `ctx.fileIcons.add(row => node | null)`, `ctx.editorExtensions.add(extension)` (build it from `@ivin/plugin-api/editor`), `ctx.fileUrl(path)` for an `<img>` of a file of the plugin's folder.
- Hooks, imported from `@ivin/plugin-api/ui` and called in components: `useSession`, `useSessions`, `useProjects`, `useTabs`, `useAnnotations`, `useUsage`, `useDraft`, `useSendMessage`, `useOpenFile`, `useOpenView` and the others its types list. Read the declarations in `@ivin/plugin-api/ui` rather than guessing a name.
- Components such as `Button` and `Slot` also come from `@ivin/plugin-api/ui`: use them so the plugin looks like the app.

A throw while rendering is contained to the plugin's slot; an error in an event handler goes to `ivin plugin logs <id>`.

## Views

A view is a screen the plugin declares in `package.json` and registers in `activate`:

```json
"views": { "board": { "title": "Board", "icon": "layout", "placements": ["subView", "sheet"], "defaultPlacement": "subView" } }
```

`ctx.views.register("board", { component })` provides its component; `ctx.views.open(sessionId, "<id>/board", params)` opens it. The user picks the placement with the setting `<id>.board.placement`.

## The server half

```ts
import { defineServer } from "@ivin/plugin-api/server"

export const activate = defineServer((ctx) => {
  console.log("started")
  ctx.signal.addEventListener("abort", () => console.log("stopped"))
})
```

It runs in the plugin host, a process of its own: a plugin that loops or crashes takes the host down, not ivin, and ivin restarts the host without it (`ivin plugin list` shows it as `disabled`). `console` output and errors go to `ivin plugin logs <id>`. `ctx.signal` aborts when the plugin is deactivated, which a reload does before the new version's `activate` runs: anything started outside `ctx` (a timer, a socket) keeps running until you stop it on `abort`. Read the declarations in `@ivin/plugin-api/server` for the rest of `ctx`.

## Permissions

`ctx.exec` and `ctx.harness.beforeSpawn` in the server half, and `ctx.fetch` in either half, fail unless `ivin.permissions` declares the call, with the missing permission in `ivin plugin logs <id>`:

```json
"permissions": { "harness": ["beforeSpawn"], "exec": ["gh", "git"], "fetch": ["api.github.com", "*.example.com"] }
```

`exec` names a program as passed to `ctx.exec` (a path matches only itself), `fetch` a host, both take `"*"` for any. The UI half reaches no other origin with the window's own `fetch`: use `ctx.fetch`. The user sees the permissions when asked to trust a project plugin, and is asked again when they change.

## When something fails

- Nothing changed on screen: `ivin plugin list` (is the half `failed`?), then `ivin plugin logs <id>`.
- `ivin plugin check <id>` says the plugin has no `tsconfig.json`: copy the one of a plugin made by `ivin plugin new`.
- `ivin doctor` checks ivin itself, including that this skill is installed.
