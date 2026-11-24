import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { listedFilesOf } from "../atoms/listed-files.ts"
import type { ListedFiles } from "../rules/file-link.ts"

export function useListedFiles(sessionId: string, workingFolder: string): ListedFiles {
  const result = useAtomValue(listedFilesOf(sessionId, workingFolder))
  if (AsyncResult.isSuccess(result)) return result.value
  return AsyncResult.isFailure(result) ? "unreadable" : "loading"
}
