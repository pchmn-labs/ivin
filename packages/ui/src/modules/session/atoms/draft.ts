import { strongFamily } from "@ivin/state/strong-family"
import { Atom } from "effect/reactivity"
import { type Draft, emptyDraft } from "../rules/draft.ts"

// Kept alive so a draft survives a session switch, which unmounts the composer.
export const draftOf = strongFamily((_sessionId: string) =>
  Atom.make<Draft>(emptyDraft).pipe(Atom.keepAlive),
)
