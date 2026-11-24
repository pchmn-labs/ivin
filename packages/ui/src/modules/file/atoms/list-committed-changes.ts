import { Atom } from "effect/reactivity"
import { rereadOnChange } from "./reread-on-change.ts"

const family = Atom.family((key: string) => {
  const [sessionId = ""] = key.split("\n")
  return rereadOnChange(sessionId, (client) => client["file.listCommittedChanges"]({ sessionId }))
})

export const committedChangesOf = (sessionId: string, workingFolder: string) =>
  family(`${sessionId}\n${workingFolder}`)
