import { Atom } from "effect/reactivity"
import type { UpdateState } from "@ivin/contracts/update"

// Null until the desktop app has answered: there is nothing to show before.
// Kept alive: the state can arrive before the lazily loaded update button reads it.
export const updateStateAtom = Atom.make<UpdateState | null>(null).pipe(Atom.keepAlive)
