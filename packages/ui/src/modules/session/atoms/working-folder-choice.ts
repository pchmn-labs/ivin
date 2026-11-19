import type { WorkingFolderChoice } from "@ivin/contracts/session"
import { strongFamily } from "@ivin/state/strong-family"
import { Atom } from "effect/reactivity"

export const workingFolderChoiceOf = strongFamily((_sessionId: string) =>
  Atom.make<WorkingFolderChoice>({ kind: "checkout" }).pipe(Atom.keepAlive),
)
