import { RegistryContext } from "@effect/atom-react"
import { HOST_MODULES_GLOBAL } from "@ivin/contracts/plugin"
import { defineUi } from "@ivin/plugin-api/ui"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeTestRegistry } from "../core/test-registry.ts"
import { commandHandlersAtom } from "../modules/command/atoms/commands.ts"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { exposeHostModules, type ImportBundle } from "../modules/plugin/adapters/plugin-bundle.ts"
import { PluginsProvider } from "./plugin-host.tsx"
import { Slot } from "./slot-renderer.tsx"

// Shaped as the server's compile writes it: each host module read from the global.
const counterBundle = `
const host = (id) => globalThis[${JSON.stringify(HOST_MODULES_GLOBAL)}][id]
const { useState } = host("react")
const { jsxs } = host("react/jsx-runtime")
const { defineUi } = host("@ivin/plugin-api/ui")
function Counter() {
  const [count] = useState(41)
  return jsxs("span", { children: ["count ", count + 1] })
}
export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.section", Counter)
  ctx.commands.register("counter.answer", { title: "Answer", run: () => 42 })
})
`

const textBundle = (text: string) => `
const { createElement } = globalThis[${JSON.stringify(HOST_MODULES_GLOBAL)}].react
export const activate = (ctx) =>
  ctx.slots.add("sidebar.section", () => createElement("span", null, ${JSON.stringify(text)}))
`

const importFromSource =
  (sources: Record<string, string>): ImportBundle =>
  async (bundle) => {
    await exposeHostModules()
    const source = sources[bundle]
    if (source === undefined) throw new Error(`no bundle ${bundle}`)
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    return import(/* @vite-ignore */ url)
  }

const textPlugin = (id: string, text: string): UiPluginEntry => ({
  manifest: { id },
  activate: defineUi((ctx) => ctx.slots.add("sidebar.section", () => <span>{text}</span>)),
})

const renderWith = async (
  builtins: ReadonlyArray<UiPluginEntry> | undefined,
  importBundle: ImportBundle,
  setUp: (server: ReturnType<typeof makeTestRegistry>["server"]) => void,
) => {
  const { server, registry } = makeTestRegistry()
  setUp(server)
  await render(
    <RegistryContext.Provider value={registry}>
      <PluginsProvider
        {...(builtins !== undefined && { plugins: builtins })}
        importBundle={importBundle}
      >
        <Slot slot="sidebar.section" props={{}} />
      </PluginsProvider>
    </RegistryContext.Provider>,
  )
  return { server, registry }
}

test("a user plugin's bundle renders with the app's React, and its command returns its value", async () => {
  const { registry } = await renderWith([], importFromSource({ "a.js": counterBundle }), (server) =>
    server.userPlugins.push({
      _tag: "compiled",
      id: "counter",
      name: "Counter",
      bundle: "a.js",
      views: [],
    }),
  )

  await expect.element(page.getByText("count 42")).toBeVisible()
  const handler = registry.get(commandHandlersAtom).find((h) => h.commandId === "counter.answer")
  expect(handler).toBeDefined()
  expect(handler?.run()).toBe(42)
})

test("a built-in plugin the server lists loads from its bundle, and a user plugin with its id replaces it", async () => {
  const imported: Array<[string, boolean]> = []
  const sources = { "b.js": textBundle("from the app"), "u.js": textBundle("from the user") }
  const importBundle: ImportBundle = (bundle, builtin) => {
    imported.push([bundle, builtin])
    return importFromSource(sources)(bundle, builtin)
  }
  await renderWith(undefined, importBundle, (server) => {
    server.builtinPlugins.push(
      { _tag: "compiled", id: "notes", name: "Notes", bundle: "b.js", views: [] },
      { _tag: "compiled", id: "other", name: "Other", bundle: "b.js", views: [] },
    )
    server.userPlugins.push({
      _tag: "compiled",
      id: "notes",
      name: "Notes",
      bundle: "u.js",
      views: [],
    })
  })

  await expect.element(page.getByText("from the user")).toBeVisible()
  await expect.element(page.getByText("from the app")).toBeVisible()
  expect(imported).toContainEqual(["b.js", true])
  expect(imported).toContainEqual(["u.js", false])
})

test("a user plugin replaces the built-in plugin with its id", async () => {
  await renderWith(
    [textPlugin("notes", "built in"), textPlugin("other", "other built in")],
    importFromSource({ "n.js": textBundle("from the user") }),
    (server) =>
      server.userPlugins.push({
        _tag: "compiled",
        id: "notes",
        name: "Notes",
        bundle: "n.js",
        views: [],
      }),
  )

  await expect.element(page.getByText("from the user")).toBeVisible()
  await expect.element(page.getByText("built in", { exact: true })).not.toBeInTheDocument()
  await expect.element(page.getByText("other built in")).toBeVisible()
})

test("a bundle that fails to import, exports no activate, or throws in activate is reported, and the rest load", async () => {
  const { server } = await renderWith(
    [textPlugin("thrower", "built-in thrower")],
    importFromSource({
      "ok.js": textBundle("loaded"),
      "none.js": "export const nothing = 1",
      "throws.js": `export const activate = () => { throw new Error("boom") }`,
    }),
    (server) =>
      server.userPlugins.push(
        { _tag: "compiled", id: "ok", name: "Ok", bundle: "ok.js", views: [] },
        { _tag: "compiled", id: "missing", name: "Missing", bundle: "missing.js", views: [] },
        { _tag: "compiled", id: "none", name: "None", bundle: "none.js", views: [] },
        { _tag: "compiled", id: "thrower", name: "Thrower", bundle: "throws.js", views: [] },
        { _tag: "failed", id: "broken", reason: "Could not compile src/ui.tsx" },
      ),
  )

  await expect.element(page.getByText("loaded")).toBeVisible()
  // The built-in plugin comes back once the user plugin replacing it fails.
  await expect.element(page.getByText("built-in thrower")).toBeVisible()
  await expect
    .poll(() => server.pluginFailures)
    .toEqual(
      expect.arrayContaining([
        { id: "missing", reason: expect.stringContaining("Could not load its UI half: no bundle") },
        { id: "none", reason: "Its UI half exports no activate function." },
        { id: "thrower", reason: "Its activate function threw: boom" },
      ]),
    )
  expect(server.pluginFailures).toHaveLength(3)
})

test("a plugin listed later, once its dependencies install, loads beside those already loaded", async () => {
  const { server } = await renderWith(
    [],
    importFromSource({ "a.js": textBundle("first plugin"), "b.js": textBundle("second plugin") }),
    (server) =>
      server.userPlugins.push({
        _tag: "compiled",
        id: "first",
        name: "First",
        bundle: "a.js",
        views: [],
      }),
  )
  await expect.element(page.getByText("first plugin")).toBeVisible()

  server.addUserPlugin({
    _tag: "compiled",
    id: "second",
    name: "Second",
    bundle: "b.js",
    views: [],
  })

  await expect.element(page.getByText("second plugin")).toBeVisible()
  await expect.element(page.getByText("first plugin")).toBeVisible()
})

test("a user plugin whose activate throws leaves the built-in in place, logged once, through later listings", async () => {
  let builtInActivations = 0
  const builtIn: UiPluginEntry = {
    manifest: { id: "changes" },
    activate: defineUi((ctx) => {
      builtInActivations++
      ctx.slots.add("sidebar.section", () => <span>built-in changes</span>)
    }),
  }
  let wasAbsent = false
  const observer = new MutationObserver(() => {
    if (document.body.textContent?.includes("built-in changes") === false) wasAbsent = true
  })
  const { server } = await renderWith(
    [builtIn],
    importFromSource({
      "bad.js": `export const activate = () => { throw new Error("boom") }`,
      "a.js": textBundle("plugin a"),
      "b.js": textBundle("plugin b"),
    }),
    (server) =>
      server.userPlugins.push({
        _tag: "compiled",
        id: "changes",
        name: "Changes",
        bundle: "bad.js",
        views: [],
      }),
  )
  await expect.element(page.getByText("built-in changes")).toBeVisible()
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  server.addUserPlugin({ _tag: "compiled", id: "a", name: "A", bundle: "a.js", views: [] })
  await expect.element(page.getByText("plugin a")).toBeVisible()
  server.addUserPlugin({ _tag: "compiled", id: "b", name: "B", bundle: "b.js", views: [] })
  await expect.element(page.getByText("plugin b")).toBeVisible()
  observer.disconnect()

  expect(server.pluginFailures).toEqual([
    { id: "changes", reason: "Its activate function threw: boom" },
  ])
  expect(builtInActivations).toBe(2)
  expect(wasAbsent).toBe(false)
  await expect.element(page.getByText("built-in changes")).toBeVisible()
})
