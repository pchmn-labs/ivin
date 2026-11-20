import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { interruptSessionAtom } from "./interrupt-session.ts"
import { sessionsOf } from "./list-sessions.ts"

const project = "/project"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  const at = DateTime.makeUnsafe(Date.now())
  server.sessions.set("s1", {
    id: "s1",
    projectPath: project,
    workingFolder: project,
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "t",
    model: "sonnet",
    status: "working",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
  })
  const sessions = sessionsOf(project)
  registry.mount(sessions.ids)
  registry.mount(interruptSessionAtom)
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toEqual(["s1"]))
  return { registry, server, sessions }
}

test("interrupting a session stops it and shows the interruption in the transcript", async () => {
  const { registry, sessions } = await setup()
  const transcript = transcriptOf("s1")
  registry.mount(transcript.view)
  await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))

  registry.set(interruptSessionAtom, { projectPath: project, sessionId: "s1" })

  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("idle"))
  await vi.waitFor(() =>
    expect(registry.get(transcript.list.items).map((i) => i.type)).toEqual(["interruption"]),
  )
})

test("the session list follows status changes pushed by the server", async () => {
  const { registry, server, sessions } = await setup()

  server.setStatus("s1", "waiting")
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("waiting"))
  server.setStatus("s1", "failed")
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("failed"))
})
