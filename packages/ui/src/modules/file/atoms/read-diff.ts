import { Atom } from "effect/reactivity"
import { rereadOnChange } from "./reread-on-change.ts"

const family = Atom.family((key: string) => {
  const [sessionId = "", , path = ""] = key.split("\n")
  return rereadOnChange(sessionId, (client) => client["file.readDiff"]({ sessionId, path }))
})

export const diffOf = (sessionId: string, workingFolder: string, path: string) =>
  family(`${sessionId}\n${workingFolder}\n${path}`)
