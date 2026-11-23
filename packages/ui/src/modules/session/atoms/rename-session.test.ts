import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { sessionsOf } from "./list-sessions.ts"
import { renameFailureOf, renameSessionAtom } from "./rename-session.ts"

const project = "/project"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "One", projectPath: project }))
  registry.mount(sessionsOf(project).ids)
  registry.mount(renameSessionAtom)
  await vi.waitFor(() => expect(registry.get(sessionsOf(project).ids)).toEqual(["s1"]))
  return { registry, server }
}

test("a failed rename keeps the old title and records its message with the title to retry", async () => {
  const { registry, server } = await setup()
  server.failNextCall("session.rename")

  registry.set(renameSessionAtom, { projectPath: project, sessionId: "s1", title: "Plan" })
  await vi.waitFor(() =>
    expect(registry.get(renameFailureOf("s1"))).toEqual({
      text: "The session was not renamed.",
      retryable: true,
      title: "Plan",
    }),
  )
  expect(registry.get(sessionsOf(project).item("s1"))?.title).toBe("One")

  registry.set(renameSessionAtom, { projectPath: project, sessionId: "s1", title: "Plan" })
  await vi.waitFor(() => expect(registry.get(renameFailureOf("s1"))).toBeNull())
  expect(registry.get(sessionsOf(project).item("s1"))?.title).toBe("Plan")
})
