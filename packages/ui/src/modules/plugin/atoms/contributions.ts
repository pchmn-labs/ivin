import { Atom } from "effect/reactivity"
import type { EditorExtension, FileIcon, SlotName } from "@ivin/plugin-api/ui"

export interface Contribution {
  readonly id: string
  readonly pluginId: string
  readonly slot: SlotName
  readonly component: unknown
  readonly order: number
  readonly replaces: string | undefined
  readonly tool: string | undefined
  readonly title: string | undefined
  readonly badge: unknown
}

export const contributionsAtom = Atom.make<ReadonlyArray<Contribution>>([]).pipe(Atom.keepAlive)

export const editorContributionsAtom = Atom.make<
  ReadonlyArray<{ readonly pluginId: string; readonly extension: EditorExtension }>
>([]).pipe(Atom.keepAlive)

export const editorExtensionsAtom = Atom.readable((get): ReadonlyArray<EditorExtension> =>
  get(editorContributionsAtom).map((contribution) => contribution.extension),
)

export const fileIconContributionsAtom = Atom.make<
  ReadonlyArray<{ readonly pluginId: string; readonly icon: FileIcon }>
>([]).pipe(Atom.keepAlive)

export const fileIconsAtom = Atom.readable((get): ReadonlyArray<FileIcon> =>
  get(fileIconContributionsAtom).map((contribution) => contribution.icon),
)
