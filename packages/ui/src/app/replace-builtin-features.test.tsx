import { RegistryProvider } from "@effect/atom-react"
import { defineUi, useSession, useSessions } from "@ivin/plugin-api/ui"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { SessionView } from "../modules/session/ui/session-view.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { builtinPlugins } from "../core/test-builtin-plugins.ts"
import { PluginsProvider } from "./plugin-host.tsx"
import { SidebarTabs } from "./sidebar-tabs.tsx"

function BranchGroups() {
  return <p>{useSessions().length} sessions by branch</p>
}

function OneLineComposer({ sessionId }: { sessionId: string }) {
  return <p>Write to {useSession(sessionId)?.title}</p>
}

const replacing: UiPluginEntry = {
  manifest: { id: "my-layout" },
  activate: defineUi((ctx) => {
    ctx.slots.add("sidebar.panel", BranchGroups, {
      name: "branches",
      title: "Branches",
      replaces: "sessions/panel",
    })
    ctx.slots.add("session.composer", OneLineComposer, { replaces: "composer/composer" })
  }),
}

const renderWith = async (plugins: ReadonlyArray<UiPluginEntry>) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set("s1", makeTestSession({ id: "s1", projectPath: "/p", title: "Fix the cart" }))
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={plugins}>
        <SidebarTabs />
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
}

test("the session list and the composer come from the built-in plugins", async () => {
  await renderWith(builtinPlugins)
  await expect.element(page.getByRole("tab", { name: "Sessions" })).toBeVisible()
  await expect.element(page.getByRole("navigation", { name: "Sessions" })).toBeVisible()
  await expect.element(page.getByRole("textbox", { name: "Message" })).toBeVisible()
})

test("a plugin that replaces them takes the place of the session list and of the composer", async () => {
  await renderWith([...builtinPlugins, replacing])
  await expect
    .element(page.getByRole("tab", { name: "Branches" }))
    .toHaveAttribute("aria-selected", "true")
  await expect.element(page.getByText("1 sessions by branch")).toBeVisible()
  await expect.element(page.getByText("Write to Fix the cart")).toBeVisible()
  expect(page.getByRole("tab", { name: "Sessions" }).query()).toBeNull()
  expect(page.getByRole("textbox", { name: "Message" }).query()).toBeNull()
})
