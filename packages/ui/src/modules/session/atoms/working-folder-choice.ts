import type { WorkingFolderChoice } from "@ivin/contracts/session"
import { strongFamily } from "@ivin/state/strong-family"
import { Atom } from "effect/reactivity"

// Read by the composer and the session's sidebar row until the first message.
export const workingFolderChoiceOf = strongFamily((_sessionId: string) =>
  Atom.make<WorkingFolderChoice>({ kind: "checkout" }).pipe(Atom.keepAlive),
)
