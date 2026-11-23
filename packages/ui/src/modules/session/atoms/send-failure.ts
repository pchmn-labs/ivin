import { strongFamily } from "@ivin/state/strong-family"
import { Atom } from "effect/reactivity"
import type { ActionFailure, Draft } from "@ivin/plugin-api/ui"

export interface SendFailure extends ActionFailure {
  readonly draft: Draft
}

// The last send of the session that failed, kept for its composer to show when it mounts.
export const sendFailureOf = strongFamily((_sessionId: string) =>
  Atom.make<SendFailure | null>(null).pipe(Atom.keepAlive),
)
