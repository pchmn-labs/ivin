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
    workingFolder: project,
    inWorktree: false,
    branch: "main",
    started: false,
    workingFolderDeleted: false,
    title: "New session",
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
    waitingFor: null,
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
  expect(registry.get(sessions.item("s1"))?.title).toBe("New session")

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

test("a message sent while another is still on its way does not cancel it", async () => {
  const { registry, server, transcript } = await setup()
  const first = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", text: "one" })
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))
  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", text: "two" })
  first.release()

  await vi.waitFor(
    () =>
      expect(
        registry.get(transcript.list.ids).map((id) => {
          const item = registry.get(transcript.list.item(id))
          return item?.type === "message" ? item.text : null
        }),
      ).toEqual(["one", "two"]),
    { timeout: 500 },
  )
})

test("a message's images show as references at once and reach the server with their bytes", async () => {
  const { registry, server, transcript } = await setup()
  const send = server.holdNextSend()
  const image = { id: "i1", number: 1, mediaType: "image/png" as const, base64: "iVBO" }

  registry.set(sendMessageAtom, {
    projectPath: project,
    sessionId: "s1",
    text: "see [Image #1]",
    images: [image],
  })
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))
  const [id] = registry.get(transcript.list.ids)
  expect(registry.get(transcript.list.item(id!))).toMatchObject({
    images: [{ id: "i1", number: 1, mediaType: "image/png" }],
  })
  expect(JSON.stringify(registry.get(transcript.list.item(id!)))).not.toContain("iVBO")

  send.release()
  await vi.waitFor(() => expect(server.sentMessages.at(-1)?.images).toEqual([image]))
})

test("a message sent while the session works is pending at once, and joins the transcript once the agent reads it", async () => {
  const { registry, server, sessions, transcript } = await setup()
  server.setStatus("s1", "working")
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("working"))
  const send = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", text: "also" })
  await vi.waitFor(() =>
    expect(registry.get(sessions.item("s1"))?.pendingMessages).toMatchObject([{ text: "also" }]),
  )
  expect(registry.get(transcript.list.ids)).toEqual([])

  send.release()
  await vi.waitFor(() => expect(server.sessions.get("s1")?.pendingMessages).toHaveLength(1))
  server.readPendingMessages("s1")
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))
  const [id] = registry.get(transcript.list.ids)
  expect(registry.get(transcript.list.item(id!))).toMatchObject({ text: "also", steer: true })
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.pendingMessages).toEqual([]))
})

test("a pending message the server rejects leaves the pending list", async () => {
  const { registry, server, sessions } = await setup()
  server.setStatus("s1", "waiting")
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("waiting"))
  const send = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", text: "oops" })
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.pendingMessages).toHaveLength(1))

  send.fail()
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.pendingMessages).toEqual([]))
})
