import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { sessionsOf } from "./list-sessions.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { draftOf } from "./draft.ts"
import { sendMessageAtom } from "./send-message.ts"
import { sendFailureOf } from "./send-failure.ts"

const project = "/project"

const draft = (text: string) => ({ text, images: [] })

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  const at = DateTime.makeUnsafe(Date.now())
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      projectPath: project,
      started: false,
      title: "New session",
      statusChangedAt: at,
      createdAt: at,
      lastActivityAt: at,
    }),
  )
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

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("hello") })
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

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("oops") })
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))

  send.fail()
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toEqual([]))
})

test("a message sent while another is still on its way does not cancel it", async () => {
  const { registry, server, transcript } = await setup()
  const first = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("one") })
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toHaveLength(1))
  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("two") })
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
    draft: { text: "see [Image #1]", images: [{ ...image, name: "shot.png" }] },
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

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("also") })
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

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("oops") })
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.pendingMessages).toHaveLength(1))

  send.fail()
  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.pendingMessages).toEqual([]))
})

test("a failed send puts its draft back and records its error, with nobody looking at the session", async () => {
  const { registry, server } = await setup()
  const send = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("lost?") })
  send.fail()

  await vi.waitFor(() =>
    expect(registry.get(sendFailureOf("s1"))).toMatchObject({
      retryable: true,
      draft: draft("lost?"),
    }),
  )
  expect(registry.get(draftOf("s1"))).toEqual(draft("lost?"))
})

test("a failed send keeps what the user typed since", async () => {
  const { registry, server } = await setup()
  const send = server.holdNextSend()
  registry.set(draftOf("s1"), draft("sent"))

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("sent") })
  expect(registry.get(draftOf("s1"))).toEqual(draft(""))
  registry.set(draftOf("s1"), draft("newer"))
  send.fail()

  await vi.waitFor(() => expect(registry.get(sendFailureOf("s1"))).not.toBeNull())
  expect(registry.get(draftOf("s1"))).toEqual(draft("newer"))
})

test("two sends at once report their own result: only the failed one shows an error", async () => {
  const { registry, server } = await setup()
  server.sessions.set("s2", makeTestSession({ id: "s2", title: "Two", projectPath: project }))
  const first = server.holdNextSend()

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("one") })
  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s2", draft: draft("two") })
  await vi.waitFor(() => expect(server.sentMessages.map((m) => m.text)).toEqual(["one", "two"]))
  await vi.waitFor(() => expect(registry.get(sessionsOf(project).item("s2"))?.started).toBe(true))
  first.fail()

  await vi.waitFor(() => expect(registry.get(sendFailureOf("s1"))?.draft).toEqual(draft("one")))
  expect(registry.get(sendFailureOf("s2"))).toBeNull()
  expect(registry.get(draftOf("s2"))).toEqual(draft(""))
})

test("a send that succeeds clears the last failure of its session", async () => {
  const { registry, server } = await setup()
  const first = server.holdNextSend()
  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("a") })
  first.fail()
  await vi.waitFor(() => expect(registry.get(sendFailureOf("s1"))).not.toBeNull())

  registry.set(sendMessageAtom, { projectPath: project, sessionId: "s1", draft: draft("a") })
  await vi.waitFor(() => expect(server.sentMessages.map((m) => m.text)).toEqual(["a", "a"]))
  expect(registry.get(sendFailureOf("s1"))).toBeNull()
})
