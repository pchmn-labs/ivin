import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useEffect } from "react"
import { taskOutputOf } from "../atoms/background-tasks.ts"
import type { TaskItem } from "../rules/background-tasks.ts"

const POLL_MS = 1000

// A running command's output as the agent writes it, read again every second; the output it ended with after.
export function useTaskOutput(sessionId: string, task: TaskItem): string {
  const read = taskOutputOf(sessionId)(task.taskId)
  const result = useAtomValue(read)
  const refresh = useAtomRefresh(read)
  const running = task.status === "running"
  useEffect(() => {
    if (!running) return
    const timer = setInterval(refresh, POLL_MS)
    return () => clearInterval(timer)
  }, [refresh, running])
  const live = AsyncResult.isSuccess(result) ? result.value : null
  return running ? (live ?? "") : (task.output ?? live ?? "")
}
