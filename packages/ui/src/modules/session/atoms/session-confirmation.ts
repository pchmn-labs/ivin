import type { Session } from "@ivin/contracts/session"
import { Atom } from "effect/reactivity"
import type { ConfirmedAction } from "../rules/session-action-failure.ts"

// The archive or delete waiting for the user to confirm it.
export const sessionConfirmationAtom = Atom.make<{
  readonly action: ConfirmedAction
  readonly session: Session
} | null>(null)
