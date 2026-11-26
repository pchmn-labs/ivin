import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { afterEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { defineUi } from "@ivin/plugin-api/ui"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { SidebarTabs } from "../../../app/sidebar-tabs.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import type { UiPluginEntry } from "../../plugin/atoms/activate-plugin.ts"
import { TabBar } from "../../tab/ui/tab-bar.tsx"
import { SessionCards, cardHandles } from "./session-card.tsx"

// A section for the sessions whose title starts with "Has", nothing for the others.
const cardPlugin: UiPluginEntry = {
  manifest: { id: "test-card" },
  activate: defineUi((ctx) => {
    ctx.slots.add("session.card", ({ session }) =>
      session.title.startsWith("Has") ? <p>Section of {session.title}</p> : null,
    )
  }),
}

// The handles outlive a test, so a card left open would show in the next one.
afterEach(() => {
  cardHandles.row.close()
  cardHandles.tab.close()
})

const setup = async () => {
  // Wide enough for the card to open beside the rows without covering the next one.
  await page.viewport(1200, 800)
  // The pointer stays where the previous test left it, over a trigger.
  await userEvent.unhover(document.body)
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  for (const [id, title] of [
    ["s1", "Has one"],
    ["s2", "Has two"],
    ["s3", "Plain"],
  ] as const) {
    server.sessions.set(id, makeTestSession({ id, title, projectPath: "/p" }))
    server.openTab(id)
  }
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={[...builtinPlugins, cardPlugin]}>
        <SidebarTabs />
        <TabBar projectPath="/p" />
        <SessionCards />
      </PluginsProvider>
    </RegistryProvider>,
  )
}

const cards = () => document.querySelectorAll('[data-testid="session-card"]')

test("hovering a session's row opens a card with the section the plugins contribute", async () => {
  await setup()
  await page.getByTestId("session-item").nth(0).hover()
  await expect.element(page.getByText("Section of Has one")).toBeVisible()
})

test("hovering a session's tab opens its card too", async () => {
  await setup()
  await page.getByTestId("tab").nth(1).hover()
  await expect.element(page.getByText("Section of Has two")).toBeVisible()
})

test("the card stays closed while no section renders anything", async () => {
  await setup()
  await page.getByTestId("session-item").nth(2).hover()
  // Open, but with nothing to show, so it is not drawn.
  await expect.poll(() => cards().length).toBe(1)
  await expect.element(page.getByTestId("session-card")).not.toBeVisible()
})

test("one card moves to another row hovered while it is open", async () => {
  await setup()
  await page.getByTestId("session-item").nth(0).hover()
  await expect.element(page.getByText("Section of Has one")).toBeVisible()

  await page.getByTestId("session-item").nth(1).hover()
  await expect.element(page.getByText("Section of Has two")).toBeVisible()
  await expect.element(page.getByText("Section of Has one")).not.toBeVisible()
  expect(cards()).toHaveLength(1)
})
