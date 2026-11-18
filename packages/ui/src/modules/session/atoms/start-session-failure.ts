import type { ActionFailure } from "@ivin/plugin-api/ui"
import { Atom } from "effect/reactivity"

export const startSessionFailureAtom = Atom.make<{
  readonly projectPath: string
  readonly model: string
  readonly failure: ActionFailure
} | null>(null)
