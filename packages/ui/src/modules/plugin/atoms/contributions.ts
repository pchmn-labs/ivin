import { Atom } from "effect/reactivity"
import type { SlotName } from "@ivin/plugin-api/ui"

export interface Contribution {
  readonly id: string
  readonly pluginId: string
  readonly slot: SlotName
  readonly component: unknown
  readonly order: number
  readonly replaces: string | undefined
  readonly tool: string | undefined
}

export const contributionsAtom = Atom.make<ReadonlyArray<Contribution>>([]).pipe(Atom.keepAlive)
