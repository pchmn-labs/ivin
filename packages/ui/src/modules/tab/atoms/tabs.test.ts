import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { openProjectAtom } from "../../project/atoms/open-project.ts"
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
    await vi.waitFor(() => expect(server.sessions.size).toBe(n))
    registry.set(openTabAtom, { sessionId: `session-${n}` })
    await vi.waitFor(() => expect(registry.get(tabs).tabs).toHaveLength(n))
  }
  const ids = () => registry.get(tabs).tabs.map((tab) => tab.sessionId)
  return { registry, server, tabs, ids }
}

test("opening the tab of a new session selects it", async () => {
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
  registry.set(closeTabAtom, { projectPath: project, sessionId: "session-3" })
  await vi.waitFor(() => expect(ids()).toEqual(["session-1", "session-2"]))
  expect(registry.get(tabs).selectedSessionId).toBe("session-2")
})

test("a closed tab leaves at once and stays gone once the server answers", async () => {
  const { registry, server, tabs, ids } = await setup()
  const close = server.holdNextCall("tab.close")

  registry.set(closeTabAtom, { projectPath: project, sessionId: "session-3" })
  expect(ids()).toEqual(["session-1", "session-2"])
  expect(registry.get(tabs).selectedSessionId).toBe("session-2")

  close.release()
  await vi.waitFor(() => expect(server.tabOrder(project)).toEqual(["session-1", "session-2"]))
  expect(ids()).toEqual(["session-1", "session-2"])
})

test("a tab whose close fails comes back at its place, still selected", async () => {
  const { registry, server, tabs, ids } = await setup()
  const close = server.holdNextCall("tab.close")

  registry.set(closeTabAtom, { projectPath: project, sessionId: "session-3" })
  expect(ids()).toEqual(["session-1", "session-2"])

  close.fail()
  await vi.waitFor(() => expect(ids()).toEqual(["session-1", "session-2", "session-3"]))
  expect(registry.get(tabs).selectedSessionId).toBe("session-3")
})

test("the answer to a first close does not bring back a tab closed after it", async () => {
  const { registry, server, ids } = await setup()
  const first = server.holdNextCall("tab.close")
  registry.set(closeTabAtom, { projectPath: project, sessionId: "session-1" })
  registry.set(closeTabAtom, { projectPath: project, sessionId: "session-2" })
  await vi.waitFor(() => expect(server.tabOrder(project)).toEqual(["session-1", "session-3"]))
  expect(ids()).toEqual(["session-3"])

  first.release()
  await vi.waitFor(() => expect(server.tabOrder(project)).toEqual(["session-3"]))
  expect(ids()).toEqual(["session-3"])
})

test("opening another tab while a close waits does not show the closed tab again", async () => {
  const { registry, server, tabs, ids } = await setup()
  const close = server.holdNextCall("tab.close")
  registry.set(closeTabAtom, { projectPath: project, sessionId: "session-3" })

  registry.set(openTabAtom, { sessionId: "session-1" })
  await vi.waitFor(() => expect(registry.get(tabs).selectedSessionId).toBe("session-1"))
  expect(ids()).toEqual(["session-1", "session-2"])

  close.release()
  await vi.waitFor(() => expect(server.tabOrder(project)).toEqual(["session-1", "session-2"]))
  expect(ids()).toEqual(["session-1", "session-2"])
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

const seeded = () => {
  const { registry, server } = makeTestRegistry({ project: "/project" })
  const at = DateTime.makeUnsafe(0)
  for (const id of ["s1", "s2"]) {
    server.sessions.set(id, {
      id,
      projectPath: project,
      workingFolder: project,
      inWorktree: false,
      branch: "main",
      started: true,
      workingFolderDeleted: false,
      title: id,
      harness: "claude",
      model: "sonnet",
      effort: "high",
      permissionMode: "manual",
      relaunchFailure: null,
      pendingMessages: [],
      unreadMessages: [],
      status: "idle",
      statusChangedAt: at,
      createdAt: at,
      lastActivityAt: at,
      archivedAt: null,
      lastImageNumber: 0,
    })
    server.openTab(id)
  }
  return { registry, server }
}

test("the tab list is not loaded until the server answers", async () => {
  const { registry, server } = seeded()
  const list = server.holdNextTabList()
  const tabs = tabsOf(project)
  registry.mount(tabs.value)
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(registry.get(tabs.loaded)).toBe(false)

  list.release()
  await vi.waitFor(() => expect(registry.get(tabs.loaded)).toBe(true))
})

test("a reorder before the tab list loads changes nothing and keeps the load", async () => {
  const { registry, server } = seeded()
  const list = server.holdNextTabList()
  const tabs = tabsOf(project).value
  registry.mount(tabs)
  registry.mount(reorderTabsAtom)

  registry.set(reorderTabsAtom, { projectPath: project, sessionIds: ["s2", "s1"] })
  await new Promise((resolve) => setTimeout(resolve, 20))
  list.release()
  await vi.waitFor(() =>
    expect(registry.get(tabs).tabs.map((t) => t.sessionId)).toEqual(["s1", "s2"]),
  )
})

test("opening the tab of another project's session selects that project", async () => {
  const { registry, server } = await setup()
  registry.mount(projectsAtom.value)
  registry.mount(openProjectAtom)
  registry.set(openProjectAtom, "/other")
  await vi.waitFor(() => expect(registry.get(projectsAtom.value).selectedPath).toBe("/other"))
  expect(server.sessions.get("session-1")?.projectPath).toBe(project)

  registry.set(openTabAtom, { sessionId: "session-1" })

  await vi.waitFor(() => expect(registry.get(projectsAtom.value).selectedPath).toBe(project))
  expect(registry.get(tabsOf(project).value).selectedSessionId).toBe("session-1")
})
