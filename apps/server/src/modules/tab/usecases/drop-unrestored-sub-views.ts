import { Effect, Layer } from "effect"
import { listViews } from "../../plugin/usecases/list-views.ts"
import { TabStore } from "./tab-store.ts"

export const dropUnrestoredSubViews = Effect.gen(function* () {
  const unrestored = (yield* listViews).filter((view) => !view.restore).map((view) => view.view)
  yield* (yield* TabStore).removeSubViewsOfViews(unrestored)
})

// Built once when the server starts, which is what a relaunch is.
export const layerUnrestoredSubViewsDropped = Layer.effectDiscard(dropUnrestoredSubViews)
