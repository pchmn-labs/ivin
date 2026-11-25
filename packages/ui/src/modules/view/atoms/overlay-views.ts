import type { SubView } from "@ivin/contracts/tab"
import { strongFamily } from "@ivin/state/strong-family"
import { Atom } from "effect/reactivity"
import { noSheetViews, type SheetViews } from "../rules/overlay-views.ts"

// Keyed by working folder too, so a session that moves starts again with none open.
const sheetViews = strongFamily((_key: string) =>
  Atom.keepAlive(Atom.make<SheetViews>(noSheetViews)),
)
const dialogView = strongFamily((_key: string) => Atom.keepAlive(Atom.make<SubView | null>(null)))

export const sheetViewsOf = (sessionId: string, workingFolder: string) =>
  sheetViews(`${sessionId}\n${workingFolder}`)

export const dialogViewOf = (sessionId: string, workingFolder: string) =>
  dialogView(`${sessionId}\n${workingFolder}`)
