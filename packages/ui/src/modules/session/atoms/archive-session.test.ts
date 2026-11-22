import { expect, test, vi } from "vitest"
import { AsyncResult } from "effect/reactivity"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { archiveSessionAtom } from "./archive-session.ts"
import { deleteSessionAtom } from "./delete-session.ts"
import { archivedSessionsOf } from "./list-archived-sessions.ts"
import { sessionsOf } from "./list-sessions.ts"
import { restoreSessionAtom } from "./restore-session.ts"
import { sessionActionFailureOf } from "./session-action-failure.ts"

const project = "/p"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  server.openProject(project)
  for (const id of ["s1", "s2"]) {
    server.sessions.set(id, makeTestSession({ id, title: `Session ${id}`, projectPath: project }))
    server.openTab(id)
  }
  const sessions = sessionsOf(project)
  const tabs = tabsOf(project)
  const archived = archivedSessionsOf(project)
  registry.mount(sessions.ids)
  registry.mount(tabs.value)
  registry.mount(archived)
  registry.mount(archiveSessionAtom)
  registry.mount(restoreSessionAtom)
  registry.mount(deleteSessionAtom)
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toHaveLength(2))
  await vi.waitFor(() => expect(registry.get(tabs.value).tabs).toHaveLength(2))
  const archivedIds = () =>
    AsyncResult.getOrElse(registry.get(archived), () => []).map((session) => session.id)
  const tabIds = () => registry.get(tabs.value).tabs.map((tab) => tab.sessionId)
  return { registry, server, sessions, archivedIds, tabIds }
}

test("archiving a session closes its tab and moves it from the session list to the archived list", async () => {
  const { registry, sessions, archivedIds, tabIds } = await setup()

  registry.set(archiveSessionAtom, { projectPath: project, sessionId: "s1" })

  await vi.waitFor(() => expect(registry.get(sessions.ids)).toEqual(["s2"]))
  await vi.waitFor(() => expect(tabIds()).toEqual(["s2"]))
  await vi.waitFor(() => expect(archivedIds()).toEqual(["s1"]))
})

test("an archived session leaves the session list and the tabs before the server answers", async () => {
  const { registry, server, sessions, archivedIds, tabIds } = await setup()
  const archive = server.holdNextCall("session.archive")

  registry.set(archiveSessionAtom, { projectPath: project, sessionId: "s1" })
  expect(registry.get(sessions.ids)).toEqual(["s2"])
  expect(tabIds()).toEqual(["s2"])

  archive.release()
  await vi.waitFor(() => expect(archivedIds()).toEqual(["s1"]))
  expect(registry.get(sessions.ids)).toEqual(["s2"])
  expect(tabIds()).toEqual(["s2"])
})

test("a session whose agent stops while it is archived stays off the session list", async () => {
  const { registry, server, sessions, archivedIds } = await setup()
  server.setStatus("s1", "working")
  const archive = server.holdNextCall("session.archive")

  registry.set(archiveSessionAtom, { projectPath: project, sessionId: "s1" })
  server.setStatus("s1", "idle")
  server.setStatus("s2", "waiting")
  await vi.waitFor(() => expect(registry.get(sessions.item("s2"))?.status).toBe("waiting"))
  expect(registry.get(sessions.ids)).toEqual(["s2"])

  archive.release()
  await vi.waitFor(() => expect(archivedIds()).toEqual(["s1"]))
  expect(registry.get(sessions.ids)).toEqual(["s2"])
})

test("restoring an archived session lists it again and takes it off the archived list", async () => {
  const { registry, sessions, archivedIds } = await setup()
  registry.set(archiveSessionAtom, { projectPath: project, sessionId: "s1" })
  await vi.waitFor(() => expect(archivedIds()).toEqual(["s1"]))

  registry.set(restoreSessionAtom, { projectPath: project, sessionId: "s1" })

  await vi.waitFor(() => expect(archivedIds()).toEqual([]))
  await vi.waitFor(() => expect([...registry.get(sessions.ids)].sort()).toEqual(["s1", "s2"]))
})

test("deleting a session takes it off the session list, the tabs and the archived list", async () => {
  const { registry, server, sessions, archivedIds, tabIds } = await setup()
  registry.set(archiveSessionAtom, { projectPath: project, sessionId: "s2" })
  await vi.waitFor(() => expect(archivedIds()).toEqual(["s2"]))

  registry.set(deleteSessionAtom, { projectPath: project, sessionId: "s1" })
  registry.set(deleteSessionAtom, { projectPath: project, sessionId: "s2" })

  await vi.waitFor(() => expect(registry.get(sessions.ids)).toEqual([]))
  await vi.waitFor(() => expect(tabIds()).toEqual([]))
  await vi.waitFor(() => expect(archivedIds()).toEqual([]))
  expect(server.sessions.size).toBe(0)
})

test("a failed archive keeps the session and its tab, and says why next to the session", async () => {
  const { registry, server, sessions, tabIds } = await setup()
  server.failNextCall("session.archive")

  registry.set(archiveSessionAtom, { projectPath: project, sessionId: "s1" })

  await vi.waitFor(() =>
    expect(registry.get(sessionActionFailureOf("s1"))).toBe("The session was not archived."),
  )
  expect([...registry.get(sessions.ids)].sort()).toEqual(["s1", "s2"])
  expect(tabIds()).toEqual(["s1", "s2"])
})

test("a failed delete keeps the session and says why, until the next try succeeds", async () => {
  const { registry, server, sessions } = await setup()
  server.failNextCall("session.delete")

  registry.set(deleteSessionAtom, { projectPath: project, sessionId: "s1" })
  await vi.waitFor(() =>
    expect(registry.get(sessionActionFailureOf("s1"))).toBe("The session was not deleted."),
  )
  expect(registry.get(sessions.ids)).toContain("s1")

  registry.set(deleteSessionAtom, { projectPath: project, sessionId: "s1" })
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toEqual(["s2"]))
  expect(registry.get(sessionActionFailureOf("s1"))).toBeNull()
})
