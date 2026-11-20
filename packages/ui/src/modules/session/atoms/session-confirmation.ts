import type { Session } from "@ivin/contracts/session"
import { Atom } from "effect/reactivity"

// The archive or delete waiting for the user to confirm it.
export const sessionConfirmationAtom = Atom.make<{
  readonly action: "archive" | "delete"
  readonly session: Session
} | null>(null)
