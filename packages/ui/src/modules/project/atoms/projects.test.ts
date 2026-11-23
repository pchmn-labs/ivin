import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { fileEditOf, unsavedPathsOf } from "../../file/atoms/file-edit.ts"
import { noEdit } from "../../file/rules/file-edit.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { createSessionAtom } from "../../session/atoms/create-session.ts"
import { closeProjectAtom } from "./close-project.ts"
import { projectsAtom } from "./list-projects.ts"
import { openProjectAtom } from "./open-project.ts"
import { selectProjectAtom } from "./select-project.ts"
import { selectedProjectAtom } from "./selected-project.ts"

const setup = () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(projectsAtom.value)
  registry.mount(selectedProjectAtom)
  registry.mount(openProjectAtom)
  registry.mount(closeProjectAtom)
  registry.mount(selectProjectAtom)
  registry.mount(createSessionAtom)
  registry.mount(openTabAtom)
  const paths = () => registry.get(projectsAtom.value).projects.map((p) => p.path)
  return { registry, server, paths }
}

test("opening folders lists them in order and selects the last one opened", async () => {
  const { registry, paths } = setup()
  registry.set(openProjectAtom, { path: "/a" })
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  registry.set(openProjectAtom, { path: "/b" })
  await vi.waitFor(() => expect(paths()).toEqual(["/a", "/b"]))
  expect(registry.get(selectedProjectAtom)?.path).toBe("/b")

  registry.set(selectProjectAtom, "/a")
  await vi.waitFor(() => expect(registry.get(selectedProjectAtom)?.path).toBe("/a"))
})

test("closing the selected project selects the next one and drops its tabs", async () => {
  const { registry, server, paths } = setup()
  registry.set(openProjectAtom, { path: "/a" })
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  registry.set(openProjectAtom, { path: "/b" })
  await vi.waitFor(() => expect(paths()).toEqual(["/a", "/b"]))
  registry.mount(tabsOf("/b").value)
  registry.set(createSessionAtom, { projectPath: "/b", model: "sonnet" })
  await vi.waitFor(() => expect(server.sessions.size).toBe(1))
  registry.set(openTabAtom, { sessionId: "session-1" })
  await vi.waitFor(() => expect(registry.get(tabsOf("/b").value).tabs).toHaveLength(1))

  registry.set(closeProjectAtom, "/b")
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  expect(registry.get(selectedProjectAtom)?.path).toBe("/a")
  expect(registry.get(tabsOf("/b").value).tabs).toEqual([])
})

test("closing a project drops the unsaved edits of its sessions", async () => {
  const { registry, server, paths } = setup()
  registry.set(openProjectAtom, { path: "/a" })
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  registry.mount(sessionsOf("/a").ids)
  registry.set(createSessionAtom, { projectPath: "/a", model: "sonnet" })
  await vi.waitFor(() => expect(server.sessions.size).toBe(1))
  await vi.waitFor(() => expect(registry.get(sessionsOf("/a").ids)).toEqual(["session-1"]))
  const folder = registry.get(sessionsOf("/a").item("session-1"))?.workingFolder ?? ""
  registry.set(fileEditOf("session-1", folder, "README.md"), {
    ...noEdit,
    base: { text: "a", version: "1" },
    draft: "b",
  })

  registry.set(closeProjectAtom, "/a")

  await vi.waitFor(() => expect(paths()).toEqual([]))
  expect(registry.get(unsavedPathsOf("session-1", folder))).toEqual([])
})
