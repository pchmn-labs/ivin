import { Atom } from "effect/reactivity"
import { rereadOnChange } from "./reread-on-change.ts"

export const gitStatusOf = Atom.family((sessionId: string) =>
  rereadOnChange(sessionId, (client) => client["file.gitStatus"]({ sessionId })),
)
