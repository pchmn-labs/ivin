import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { answerQuestionAtom } from "./answer-question.ts"
import { sessionsOf } from "./list-sessions.ts"

const project = "/project"

test("answering questions stores the answers on their item and updates the session", async () => {
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
    harness: "claude",
    model: "sonnet",
    effort: "high",
    permissionMode: "manual",
    relaunchFailure: null,
    pendingMessages: [],
    unreadMessages: [],
    status: "waiting",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
    waitingFor: null,
  })
  server.seedItems("s1", [
    {
      id: "a1",
      sessionId: "s1",
      position: 0,
      at: 0,
      type: "question",
      requestId: "q1",
      toolCallId: null,
      questions: [{ question: "Which?", header: "Pick", options: [], multiSelect: false }],
      status: "open",
      answers: [],
    },
  ])
  const sessions = sessionsOf(project)
  const transcript = transcriptOf("s1")
  registry.mount(sessions.ids)
  registry.mount(transcript.view)
  registry.mount(answerQuestionAtom)
  await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))

  registry.set(answerQuestionAtom, {
    projectPath: project,
    sessionId: "s1",
    requestId: "q1",
    answers: [{ question: "Which?", choices: ["Mine"] }],
  })

  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("working"))
  await vi.waitFor(() =>
    expect(registry.get(transcript.list.item("a1"))).toMatchObject({
      status: "answered",
      answers: [{ question: "Which?", choices: ["Mine"] }],
    }),
  )
})
