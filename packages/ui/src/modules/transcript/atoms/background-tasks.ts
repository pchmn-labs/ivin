import { Effect } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import type { TaskItem } from "../rules/background-tasks.ts"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { transcriptOf } from "./get-items.ts"

// The task whose detail the sheet shows, by session; null while the sheet is closed.
export const openTaskOf = strongFamily((_sessionId: string) =>
  Atom.keepAlive(Atom.make<string | null>(null)),
)

// The loaded page's tasks, running or ended, in the order they started.
export const tasksOf = strongFamily((sessionId: string) =>
  Atom.readable((get) =>
    get(transcriptOf(sessionId).list.items).filter(
      (item): item is TaskItem => item.type === "task",
    ),
  ),
)

const isStepOf = (toolCallId: string) => (item: TranscriptItem) =>
  "parentToolCallId" in item && item.parentToolCallId === toolCallId

// A background subagent's whole run: what the server stored, then the steps that follow live.
export const taskStepsOf = strongFamily((sessionId: string) =>
  strongFamily((toolCallId: string) => {
    const stored = serverRuntime.atom(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return yield* client["transcript.getTaskItems"]({ sessionId, toolCallId })
      }),
    )
    return Atom.readable((get) => {
      const result = get(stored)
      const fetched = AsyncResult.isSuccess(result) ? result.value : []
      const byId = new Map<string, TranscriptItem>(fetched.map((item) => [item.id, item]))
      for (const item of get(transcriptOf(sessionId).list.items).filter(isStepOf(toolCallId)))
        byId.set(item.id, item)
      return [...byId.values()].toSorted((a, b) => a.position - b.position)
    })
  }),
)

// The end of a running command's output, read again on each refresh; null once the agent no longer runs it.
export const taskOutputOf = strongFamily((sessionId: string) =>
  strongFamily((taskId: string) =>
    serverRuntime.atom(
      Effect.gen(function* () {
        const client = yield* ServerClient
        return yield* client["session.taskOutput"]({ sessionId, taskId })
      }),
    ),
  ),
)
