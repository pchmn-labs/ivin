import { Atom } from "effect/reactivity"
import { rereadOnChange } from "./reread-on-change.ts"

export const committedChangesOf = Atom.family((sessionId: string) =>
  rereadOnChange(sessionId, (client) => client["file.listCommittedChanges"]({ sessionId })),
)
