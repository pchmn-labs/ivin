import { Atom } from "effect/reactivity"
import { DEFAULT_MODEL, type Model } from "../rules/models.ts"

export const newSessionModelAtom = Atom.make<Model>(DEFAULT_MODEL)
