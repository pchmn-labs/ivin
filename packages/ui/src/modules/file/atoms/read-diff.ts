import { Atom } from "effect/reactivity"
import type { DiffKind } from "../rules/diff-reading.ts"
import { rereadOnChange } from "./reread-on-change.ts"

const family = Atom.family((key: string) => {
  const [kind = "", sessionId = "", , path = ""] = key.split("\n")
  return rereadOnChange(sessionId, (client) =>
    client[kind === "committed_diff" ? "file.readCommittedDiff" : "file.readDiff"]({
      sessionId,
      path,
    }),
  )
})

export const diffOf = (kind: DiffKind, sessionId: string, workingFolder: string, path: string) =>
  family(`${kind}\n${sessionId}\n${workingFolder}\n${path}`)
