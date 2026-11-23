import { Atom } from "effect/reactivity"
import type { Confirmation } from "../rules/session-confirmation.ts"

// The archive, delete or project close waiting for the user to confirm it.
export const sessionConfirmationAtom = Atom.make<Confirmation | null>(null)
