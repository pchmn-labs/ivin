import { Atom } from "effect/reactivity"
import { rereadOnChange } from "./reread-on-change.ts"

const family = Atom.family((key: string) => {
  const [sessionId = ""] = key.split("\n")
  return rereadOnChange(sessionId, (client) => client["file.listChanges"]({ sessionId }))
})

export const changesOf = (sessionId: string, workingFolder: string) =>
  family(`${sessionId}\n${workingFolder}`)
