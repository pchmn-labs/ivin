import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { createSessionAtom } from "../../session/atoms/create-session.ts"
import { closeProjectAtom } from "./close-project.ts"
import { openProjectsAtom } from "./list-projects.ts"
import { openProjectAtom } from "./open-project.ts"
import { selectProjectAtom } from "./select-project.ts"
import { selectedProjectAtom } from "./selected-project.ts"

const setup = () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(openProjectsAtom.value)
  registry.mount(selectedProjectAtom)
  registry.mount(openProjectAtom)
  registry.mount(closeProjectAtom)
  registry.mount(selectProjectAtom)
  registry.mount(createSessionAtom)
  const paths = () => registry.get(openProjectsAtom.value).projects.map((p) => p.path)
  return { registry, server, paths }
}

test("opening folders lists them in order and selects the last one opened", async () => {
  const { registry, paths } = setup()
  registry.set(openProjectAtom, "/a")
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  registry.set(openProjectAtom, "/b")
  await vi.waitFor(() => expect(paths()).toEqual(["/a", "/b"]))
  expect(registry.get(selectedProjectAtom)?.path).toBe("/b")

  registry.set(selectProjectAtom, "/a")
  await vi.waitFor(() => expect(registry.get(selectedProjectAtom)?.path).toBe("/a"))
})

test("closing the selected project selects the next one and drops its tabs", async () => {
  const { registry, paths } = setup()
  registry.set(openProjectAtom, "/a")
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  registry.set(openProjectAtom, "/b")
  await vi.waitFor(() => expect(paths()).toEqual(["/a", "/b"]))
  registry.mount(tabsOf("/b").value)
  registry.set(createSessionAtom, { projectPath: "/b", model: "sonnet" })
  await vi.waitFor(() => expect(registry.get(tabsOf("/b").value).tabs).toHaveLength(1))

  registry.set(closeProjectAtom, "/b")
  await vi.waitFor(() => expect(paths()).toEqual(["/a"]))
  expect(registry.get(selectedProjectAtom)?.path).toBe("/a")
  expect(registry.get(tabsOf("/b").value).tabs).toEqual([])
})
