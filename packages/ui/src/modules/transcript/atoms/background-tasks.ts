import { Effect } from "effect"
import { Atom, AsyncResult } from "effect/reactivity"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { foregroundAgentRun, knownTasks, type TaskItem } from "../rules/background-tasks.ts"
import { strongFamily } from "@ivin/state/strong-family"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { openSessionsAtom } from "../../session/atoms/open-sessions.ts"
import { subViewsOf } from "../../tab/atoms/list-sub-views.ts"
import { sheetViewsOf } from "../../view/atoms/overlay-views.ts"
import type { SubView } from "@ivin/contracts/tab"
import { transcriptOf } from "./get-items.ts"

// The loaded page's tasks, running or ended, in the order they started.
export const tasksOf = strongFamily((sessionId: string) =>
  Atom.readable((get) =>
    get(transcriptOf(sessionId).list.items).filter(
      (item): item is TaskItem => item.type === "task",
    ),
  ),
)

export const taskOf = strongFamily((sessionId: string) =>
  strongFamily((taskId: string) =>
    Atom.readable((get) => {
      const background =
        get(openSessionsAtom).find((session) => session.id === sessionId)?.backgroundTasks ?? []
      const tasks = get(tasksOf(sessionId))
      const task = knownTasks(sessionId, background, tasks).find((t) => t.taskId === taskId)
      if (task !== undefined) return task
      const call = get(transcriptOf(sessionId).list.items).find(
        (item) => item.type === "tool_call" && item.toolCallId === taskId,
      )
      return call?.type === "tool_call" ? foregroundAgentRun(call, tasks) : undefined
    }),
  ),
)

export const TASK_VIEW = "tool-calls/task"

// Whether the task's view is the one its sheet or the files card shows.
export const taskShownOf = strongFamily((sessionId: string) =>
  strongFamily((taskId: string) =>
    Atom.readable((get) => {
      const workingFolder = get(openSessionsAtom).find(
        (session) => session.id === sessionId,
      )?.workingFolder
      if (workingFolder === undefined) return false
      const isTask = (view: SubView | null | undefined) =>
        view?.view === TASK_VIEW && view.params["taskId"] === taskId
      return (
        isTask(get(sheetViewsOf(sessionId, workingFolder)).selected) ||
        isTask(get(subViewsOf(sessionId, workingFolder).value)?.selected)
      )
    }),
  ),
)

const isStepOf = (toolCallId: string) => (item: TranscriptItem) =>
  "parentToolCallId" in item && item.parentToolCallId === toolCallId

// A subagent's whole run: what the server stored, then the steps that follow live.
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
