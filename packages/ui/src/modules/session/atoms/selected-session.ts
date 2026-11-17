import { Atom } from "effect/reactivity"

export const selectedSessionIdAtom = Atom.make<string | null>(null).pipe(Atom.keepAlive)
