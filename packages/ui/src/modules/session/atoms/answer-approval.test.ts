import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { transcriptOf } from "../../transcript/atoms/get-items.ts"
import { answerApprovalAtom } from "./answer-approval.ts"
import { sessionsOf } from "./list-sessions.ts"

const project = "/project"

test("answering an approval stores the decision on its item and updates the session", async () => {
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
    status: "waiting",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
  })
  server.seedItems("s1", [
    {
      id: "a1",
      sessionId: "s1",
      position: 0,
      type: "approval",
      requestId: "r1",
      toolCallId: null,
      name: "Bash",
      input: {},
      decision: null,
    },
  ])
  const sessions = sessionsOf(project)
  const transcript = transcriptOf("s1")
  registry.mount(sessions.ids)
  registry.mount(transcript.view)
  registry.mount(answerApprovalAtom)
  await vi.waitFor(() => expect(registry.get(transcript.view).loaded).toBe(true))

  registry.set(answerApprovalAtom, {
    projectPath: project,
    sessionId: "s1",
    requestId: "r1",
    allow: true,
  })

  await vi.waitFor(() => expect(registry.get(sessions.item("s1"))?.status).toBe("working"))
  await vi.waitFor(() =>
    expect(registry.get(transcript.list.item("a1"))).toMatchObject({ decision: "allow" }),
  )
})
