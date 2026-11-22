import { Atom } from "effect/reactivity"
import type { EditorExtension, SlotName } from "@ivin/plugin-api/ui"

export interface Contribution {
  readonly id: string
  readonly pluginId: string
  readonly slot: SlotName
  readonly component: unknown
  readonly order: number
  readonly replaces: string | undefined
  readonly tool: string | undefined
  readonly title: string | undefined
}

export const contributionsAtom = Atom.make<ReadonlyArray<Contribution>>([]).pipe(Atom.keepAlive)

export const editorContributionsAtom = Atom.make<
  ReadonlyArray<{ readonly pluginId: string; readonly extension: EditorExtension }>
>([]).pipe(Atom.keepAlive)

export const editorExtensionsAtom = Atom.readable((get): ReadonlyArray<EditorExtension> =>
  get(editorContributionsAtom).map((contribution) => contribution.extension),
)
