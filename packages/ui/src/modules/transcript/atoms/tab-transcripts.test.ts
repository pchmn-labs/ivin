import { expect, test, vi } from "vitest"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { createSessionAtom } from "../../session/atoms/create-session.ts"
import { archiveSessionAtom } from "../../session/atoms/archive-session.ts"
import { deleteSessionAtom } from "../../session/atoms/delete-session.ts"
import { closeTabAtom } from "../../tab/atoms/close-tab.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { openTabAtom } from "../../tab/atoms/open-tab.ts"
import { transcriptOf } from "./get-items.ts"
import { tabTranscriptsAtom } from "./tab-transcripts.ts"

const project = "/project"

const message = (sessionId: string, id: string, position: number): TranscriptItem => ({
  id,
  sessionId,
  position,
  at: 0,
  type: "message",
  role: "assistant",
  text: id,
  images: [],
})

const setup = async () => {
  const { registry, server } = makeTestRegistry({ project })
  registry.mount(tabsOf(project).value)
  registry.mount(createSessionAtom)
  registry.mount(openTabAtom)
  registry.mount(closeTabAtom)
  registry.mount(archiveSessionAtom)
  registry.mount(deleteSessionAtom)
  registry.mount(tabTranscriptsAtom)
  registry.set(createSessionAtom, { projectPath: project })
  await vi.waitFor(() => expect(server.sessions.size).toBe(1))
  const sessionId = "session-1"
  server.seedItems(sessionId, [message(sessionId, "first", 0)])
  registry.set(openTabAtom, { sessionId })
  await vi.waitFor(() => expect(registry.get(tabsOf(project).value).tabs).toHaveLength(1))

  const transcript = transcriptOf(sessionId)
  const rowIds = () => registry.get(transcript.view).rows.map((row) => row.id)
  const show = async () => {
    const unmount = registry.mount(transcript.view)
    await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))
    return unmount
  }
  // An upsert the fake server streams without storing, so only a feed already running gets it.
  const streamOnly = (id: string, position: number) =>
    server.pushChange({ type: "upsert", item: message(sessionId, id, position) })
  return { registry, sessionId, transcript, rowIds, show, streamOnly }
}

test("a session with a tab keeps its transcript fed while its view is closed", async () => {
  const { registry, transcript, rowIds, show, streamOnly } = await setup()
  ;(await show())()

  streamOnly("second", 1)
  await vi.waitFor(() => expect(registry.get(transcript.list.ids)).toContain("second"))

  const again = registry.mount(transcript.view)
  expect(registry.get(transcript.view)).toMatchObject({ loaded: true })
  expect(rowIds()).toEqual(["first", "second"])
  again()
})

test("closing a session's tab drops its transcript, which loads again when shown", async () => {
  const { registry, sessionId, transcript, rowIds, show, streamOnly } = await setup()
  ;(await show())()

  registry.set(closeTabAtom, { projectPath: project, sessionId })
  await vi.waitFor(() => expect(registry.get(transcript.paging).loaded).toBe(false))
  streamOnly("missed", 1)

  const again = await show()
  expect(rowIds()).toEqual(["first"])
  again()
})

test("archiving a session drops its transcript", async () => {
  const { registry, sessionId, transcript, show } = await setup()
  ;(await show())()

  registry.set(archiveSessionAtom, { projectPath: project, sessionId })
  await vi.waitFor(() => expect(registry.get(transcript.paging).loaded).toBe(false))
})

test("deleting a session drops its transcript", async () => {
  const { registry, sessionId, transcript, show } = await setup()
  ;(await show())()

  registry.set(deleteSessionAtom, { projectPath: project, sessionId })
  await vi.waitFor(() => expect(registry.get(transcript.paging).loaded).toBe(false))
})
