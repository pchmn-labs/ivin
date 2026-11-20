import { Atom } from "effect/reactivity"
import { strongFamily } from "@ivin/state/strong-family"

// What the user folded or unfolded, by turn and by step; absent keys take their default.
export const foldsOf = strongFamily((_sessionId: string) =>
  Atom.keepAlive(Atom.make<ReadonlyMap<string, boolean>>(new Map())),
)
