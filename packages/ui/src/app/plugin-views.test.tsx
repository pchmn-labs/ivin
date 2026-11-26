import { RegistryProvider } from "@effect/atom-react"
import type { UserSettings } from "@ivin/contracts/setting"
import { defineUi, type UiContext, type ViewProps } from "@ivin/plugin-api/ui"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { NotificationProvider } from "../core/components/notification/notification.tsx"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { TabView } from "../modules/tab/ui/tab-view.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { builtinPlugins } from "../core/test-builtin-plugins.ts"
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
        <NotificationProvider>
          {/* Isolated like the app's #root, so menus portalled to <body> paint over the sheet. */}
          <div
            style={{ height: 700, display: "flex", flexDirection: "column", isolation: "isolate" }}
          >
            <TabView projectPath="/p" />
          </div>
        </NotificationProvider>
      </PluginsProvider>
    </RegistryProvider>,
  )
  await vi.waitFor(() => expect(context).not.toBeNull())
  const open = (view: string, params: Record<string, number>, placement?: ViewPlacement) =>
    context!.views.open("s1", view, params, placement && { placement })
  return { server, open }
}
type ViewPlacement = "subView" | "sheet" | "dialog"

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
  expect(await open("demo/ghost", { id: 1 })).toMatchObject({ retryable: false })
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
  await vi.waitFor(() => expect(open).not.toBeNull())
  await open!("s1", "files/file", { path: "a.ts" })
  await expect.element(page.getByText("my own file view")).toBeVisible()
})

const card = () => page.getByRole("region", { name: "Open files" })
const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"

test("Move to takes a view from beside the chat to a dialog and back, keeping its params", async () => {
  const { open } = await setup()
  await open("demo/note", { id: 1 })

  await card().getByRole("tab", { name: "Note 1" }).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Dialog" }).click()
  await expect.element(page.getByText("note 1 in dialog")).toBeVisible()
  await expect.poll(() => card().query()).toBeNull()

  await page.getByRole("dialog").getByRole("button", { name: "Note 1" }).click()
  await page.getByRole("menuitem", { name: "Beside chat" }).click()
  await expect.element(page.getByText("note 1 in subView")).toBeVisible()
  await expect.poll(() => page.getByRole("dialog").query()).toBeNull()
})

test("a view with one placement shows no Move to", async () => {
  const { open } = await setup()
  await open("demo/tight", { id: 1 })

  await card().getByRole("tab", { name: "Tight" }).click({ button: "right" })
  await expect.element(page.getByRole("menuitem", { name: "Close" })).toBeVisible()
  expect(page.getByText("Move to").query()).toBeNull()
})

test("the Move view key opens the menu of the view in focus, and the focus lands in the moved view", async () => {
  const { open } = await setup()
  await open("demo/note", { id: 1 }, "sheet")
  ;(page.getByRole("tab", { name: "Note 1" }).element() as HTMLElement).focus()

  await userEvent.keyboard(`{${mod}>}{Shift>}o{/Shift}{/${mod}}`)
  await expect.element(page.getByRole("menuitem", { name: "Beside chat" })).toBeVisible()
  await userEvent.keyboard("{ArrowDown}")
  await expect
    .element(page.getByRole("menuitem", { name: "Beside chat" }))
    .toHaveAttribute("data-highlighted")
  await userEvent.keyboard("{Enter}")

  await expect.element(page.getByText("note 1 in subView")).toBeVisible()
  await expect
    .poll(() => document.activeElement)
    .toBe(card().getByRole("tab", { name: "Note 1" }).element())
})

test("the Move view key does nothing on a view with one placement", async () => {
  const { open } = await setup()
  await open("demo/tight", { id: 1 })
  ;(card().getByRole("tab", { name: "Tight" }).element() as HTMLElement).focus()

  await userEvent.keyboard(`{${mod}>}{Shift>}o{/Shift}{/${mod}}`)
  await expect.element(page.getByText("note 1 in subView")).toBeVisible()
  expect(page.getByRole("menu").query()).toBeNull()
})

test("a move that cannot open the view beside the chat leaves it where it was", async () => {
  const { server, open } = await setup()
  await open("demo/note", { id: 1 }, "sheet")
  server.failNextCall("tab.openSubView")

  await page.getByRole("tab", { name: "Note 1" }).click({ button: "right" })
  await page.getByRole("menuitem", { name: "Beside chat" }).click()

  await expect.element(page.getByText("Could not move the view.").first()).toBeVisible()
  await expect.element(page.getByText("note 1 in sheet")).toBeVisible()
})
