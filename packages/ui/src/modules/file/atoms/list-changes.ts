import { Atom } from "effect/reactivity"
import { rereadOnChange } from "./reread-on-change.ts"

export const changesOf = Atom.family((sessionId: string) =>
  rereadOnChange(sessionId, (client) => client["file.listChanges"]({ sessionId })),
)
