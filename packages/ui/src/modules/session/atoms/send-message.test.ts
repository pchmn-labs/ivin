import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { sessionsOf } from "./list-sessions.ts"
import { sendMessageAtom } from "./send-message.ts"

const project = "/project"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  const at = DateTime.makeUnsafe(Date.now())
  server.sessions.set("s1", {
    id: "s1",
    projectPath: project,
    title: "",
    createdAt: at,
    lastActivityAt: at,
  })
  const sessions = sessionsOf(project)
  const transcript = transcriptOf("s1")
  registry.mount(sessions.ids)
  registry.mount(transcript.view)
  registry.mount(sendMessageAtom)
  await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))
  return { registry, server, sessions, transcript }
}

test("a sent message appears at once and is reconciled by the server's item with the same id", async () => {
  const { registry, server, sessions, transcript } = await setup()
  const send = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", text: "hello" })
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))
  const [id] = registry.get(transcript.list.ids)
  expect(registry.get(transcript.list.item(id!))).toMatchObject({ role: "user", text: "hello" })
  expect(registry.get(sessions.item("s1"))?.title).toBe("")

  send.release()
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.title).toBe("hello"))
  expect(registry.get(transcript.list.ids)).toEqual([id])
  expect(registry.get(transcript.list.item(id!))).toMatchObject({ id, text: "hello", position: 0 })
})

test("a message the server rejects disappears again", async () => {
  const { registry, server, transcript } = await setup()
  const send = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", text: "oops" })
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))

  send.fail()
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toEqual([]))
  expect(registry.get(sendMessageAtom)._tag).toBe("Failure")
})
