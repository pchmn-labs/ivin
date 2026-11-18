import type { ActionFailure } from "@ivin/plugin-api/ui"
import { Atom } from "effect/reactivity"

export const openFolderFailureAtom = Atom.make<{
  readonly path: string
  readonly failure: ActionFailure
} | null>(null)
