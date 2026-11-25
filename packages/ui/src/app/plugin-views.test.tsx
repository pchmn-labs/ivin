import { RegistryProvider } from "@effect/atom-react"
import { defaultSettings, type UserSettings } from "@ivin/contracts/setting"
import { defineUi, type UiContext, type ViewProps } from "@ivin/plugin-api/ui"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { TabView } from "../modules/tab/ui/tab-view.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { builtinPlugins } from "./builtin-plugins.ts"
import { PluginsProvider } from "./plugin-host.tsx"

const declared = (name: string, placements: ViewPlacements) => ({
  name,
  title: name === "note" ? "Note" : "Tight",
  icon: "file",
  placements,
  defaultPlacement: placements[0]!,
  restore: true,
})
type ViewPlacements = ReadonlyArray<"subView" | "sheet" | "dialog">

function Note({ params, placement }: ViewProps) {
  return (
    <p>
      note {JSON.stringify(params["id"])} in {placement}
    </p>
  )
}

function Broken(): null {
  throw new Error("view broke")
}

const setup = async (
  settings: UserSettings | null = null,
  views = [declared("note", ["subView", "sheet", "dialog"]), declared("tight", ["subView"])],
  register: (ctx: UiContext) => void = (ctx) => {
    ctx.views.register("note", { component: Note, title: ({ id }) => `Note ${JSON.stringify(id)}` })
    ctx.views.register("tight", { component: Note })
  },
) => {
  let context: UiContext | null = null
  const plugin: UiPluginEntry = {
    manifest: { id: "demo", views },
    activate: defineUi((ctx) => {
      context = ctx
      register(ctx)
    }),
  }
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set("s1", makeTestSession({ id: "s1", projectPath: "/p", title: "Fix the cart" }))
  server.openTab("s1")
  if (settings !== null) server.setUserSettings(settings)
  await page.viewport(1200, 900)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={[plugin]}>
        <div style={{ height: 700 }}>
          <TabView projectPath="/p" />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  const open = (view: string, params: Record<string, number>, placement?: ViewPlacement) =>
    context!.views.open("s1", view, params, placement && { placement })
  return { server, open }
}
type ViewPlacement = "subView" | "sheet" | "dialog"

const placementSetting = (value: string) => ({
  settings: defaultSettings,
  problem: null,
  pluginSettings: [
    {
      pluginId: "demo",
      pluginName: "Demo",
      key: "note.placement",
      type: "string" as const,
      default: "subView",
      title: "Note placement",
      description: "Where Note opens.",
      values: ["subView", "sheet", "dialog"],
      value,
      ignored: false,
    },
  ],
})

test("a view opens as a tab beside the chat by default, with its title", async () => {
  const { open } = await setup()
  await open("demo/note", { id: 1 })
  await expect.element(page.getByRole("tab", { name: "Note 1" })).toBeVisible()
  await expect.element(page.getByText("note 1 in subView")).toBeVisible()
})

test("a view opens in the sheet when the caller asks for it, with a tab per view", async () => {
  const { open } = await setup()
  await open("demo/note", { id: 1 }, "sheet")
  await open("demo/note", { id: 2 }, "sheet")
  await expect.element(page.getByText("note 2 in sheet")).toBeVisible()
  await expect.element(page.getByRole("tab", { name: "Note 1" })).toBeVisible()
  await expect.element(page.getByRole("tab", { name: "Note 2" })).toBeVisible()
  ;(page.getByRole("tab", { name: "Note 1" }).element() as HTMLElement).click()
  await expect.element(page.getByText("note 1 in sheet")).toBeVisible()
})

test("a second dialog replaces the first", async () => {
  const { open } = await setup()
  await open("demo/note", { id: 1 }, "dialog")
  await expect.element(page.getByText("note 1 in dialog")).toBeVisible()
  await open("demo/note", { id: 2 }, "dialog")
  await expect.element(page.getByText("note 2 in dialog")).toBeVisible()
  expect(page.getByText("note 1 in dialog").query()).toBeNull()
})

test("the setting decides over the caller", async () => {
  const { open } = await setup(placementSetting("dialog"))
  await open("demo/note", { id: 1 }, "sheet")
  await expect.element(page.getByText("note 1 in dialog")).toBeVisible()
})

test("a placement outside the view's list falls back to its default", async () => {
  const { open } = await setup()
  await open("demo/tight", { id: 1 }, "dialog")
  await expect.element(page.getByText("note 1 in subView")).toBeVisible()
})

test("opening an equal view selects the open one instead of adding a tab", async () => {
  const { open } = await setup()
  await open("demo/note", { id: 1 })
  await open("demo/note", { id: 2 })
  await open("demo/note", { id: 1 })
  await expect.element(page.getByRole("tab", { name: "Note 1", selected: true })).toBeVisible()
  expect(page.getByRole("tab", { name: /Note/ }).elements()).toHaveLength(2)
})

test("a view that no plugin registers shows the plugin failure message", async () => {
  const { open } = await setup(null, [declared("note", ["subView"])], () => undefined)
  await open("demo/note", { id: 1 })
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("plugin demo failed — see ivin plugin logs demo")
})

test("a view that throws shows the slot failure", async () => {
  const { open } = await setup(null, [declared("note", ["subView"])], (ctx) =>
    ctx.views.register("note", { component: Broken }),
  )
  await open("demo/note", { id: 1 })
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("plugin demo failed — see ivin plugin logs demo")
})

test("a view the manifest does not declare is refused", async () => {
  const { open } = await setup(null, [declared("note", ["subView"])], (ctx) => {
    ctx.views.register("note", { component: Note })
    ctx.views.register("ghost", { component: Note })
  })
  expect(await open("demo/ghost", { id: 1 })).toMatchObject({ retryable: true })
})

test("a plugin that replaces files provides its own files/file view", async () => {
  const replacement: UiPluginEntry = {
    manifest: { id: "files", views: [declared("file", ["subView"])] },
    activate: defineUi((ctx) =>
      ctx.views.register("file", { component: () => <p>my own file view</p> }),
    ),
  }
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set("s1", makeTestSession({ id: "s1", projectPath: "/p", title: "Fix the cart" }))
  server.openTab("s1")
  server.files.set("/p/a.ts", { kind: "text", text: "a" })
  let open: UiContext["views"]["open"] | null = null
  const probe: UiPluginEntry = {
    manifest: { id: "probe" },
    activate: defineUi((ctx) => void (open = ctx.views.open)),
  }
  await page.viewport(1200, 900)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider
        plugins={[...builtinPlugins.filter((p) => p.manifest.id !== "files"), replacement, probe]}
      >
        <div style={{ height: 700 }}>
          <TabView projectPath="/p" />
        </div>
      </PluginsProvider>
    </RegistryProvider>,
  )
  await open!("s1", "files/file", { path: "a.ts" })
  await expect.element(page.getByText("my own file view")).toBeVisible()
})
