import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { createSessionAtom } from "../../session/atoms/create-session.ts"
import { closeTabAtom } from "./close-tab.ts"
import { tabsOf } from "./list-tabs.ts"
import { openTabAtom } from "./open-tab.ts"
import { reorderTabsAtom } from "./reorder-tabs.ts"

const project = "/project"

const setup = async () => {
  const { registry, server } = makeTestRegistry({ project: "/project" })
  const tabs = tabsOf(project).value
  registry.mount(tabs)
  registry.mount(createSessionAtom)
  registry.mount(openTabAtom)
  registry.mount(closeTabAtom)
  registry.mount(reorderTabsAtom)
  for (let n = 1; n <= 3; n++) {
    registry.set(createSessionAtom, { projectPath: project, model: "sonnet" })
    await vi.waitFor(() => expect(registry.get(tabs).tabs).toHaveLength(n))
  }
  const ids = () => registry.get(tabs).tabs.map((tab) => tab.sessionId)
  return { registry, server, tabs, ids }
}

test("creating a session opens its tab and selects it", async () => {
  const { registry, tabs, ids } = await setup()
  expect(ids()).toEqual(["session-1", "session-2", "session-3"])
  expect(registry.get(tabs).selectedSessionId).toBe("session-3")
})

test("opening a session that already has a tab selects it without a second tab", async () => {
  const { registry, tabs, ids } = await setup()
  registry.set(openTabAtom, { sessionId: "session-1" })
  await vi.waitFor(() => expect(registry.get(tabs).selectedSessionId).toBe("session-1"))
  expect(ids()).toEqual(["session-1", "session-2", "session-3"])
})

test("closing the selected tab selects the next one, else the previous", async () => {
  const { registry, tabs, ids } = await setup()
  registry.set(closeTabAtom, { sessionId: "session-3" })
  await vi.waitFor(() => expect(ids()).toEqual(["session-1", "session-2"]))
  expect(registry.get(tabs).selectedSessionId).toBe("session-2")
})

test("a reorder shows at once and is kept once the server answers", async () => {
  const { registry, server, tabs, ids } = await setup()
  const reorder = server.holdNextReorder()

  registry.set(reorderTabsAtom, {
    projectPath: project,
    sessionIds: ["session-3", "session-1", "session-2"],
  })
  await vi.waitFor(() => expect(ids()).toEqual(["session-3", "session-1", "session-2"]))
  expect(server.tabOrder(project)).toEqual(["session-1", "session-2", "session-3"])

  reorder.release()
  await vi.waitFor(() =>
    expect(server.tabOrder(project)).toEqual(["session-3", "session-1", "session-2"]),
  )
  expect(ids()).toEqual(["session-3", "session-1", "session-2"])
  expect(registry.get(tabs).selectedSessionId).toBe("session-3")
})

test("a reorder the server refuses is rolled back", async () => {
  const { registry, server, ids } = await setup()
  const reorder = server.holdNextReorder()

  registry.set(reorderTabsAtom, {
    projectPath: project,
    sessionIds: ["session-3", "session-1", "session-2"],
  })
  await vi.waitFor(() => expect(ids()).toEqual(["session-3", "session-1", "session-2"]))
  reorder.fail()
  await vi.waitFor(() => expect(ids()).toEqual(["session-1", "session-2", "session-3"]))
})
