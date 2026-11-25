import { Atom } from "effect/reactivity"
import type { DeclaredView, RegisteredView } from "../rules/view-types.ts"

export const declaredViewsAtom = Atom.make<ReadonlyArray<DeclaredView>>([]).pipe(Atom.keepAlive)

export const registeredViewsAtom = Atom.make<ReadonlyArray<RegisteredView>>([]).pipe(Atom.keepAlive)
