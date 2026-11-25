import { sameSubView, type SubView } from "@ivin/contracts/tab"

export interface SheetViews {
  readonly views: ReadonlyArray<SubView>
  readonly selected: SubView | null
}

export const noSheetViews: SheetViews = { views: [], selected: null }

export const withSheetViewOpen = (state: SheetViews, view: SubView): SheetViews => ({
  views: state.views.some((open) => sameSubView(open, view)) ? state.views : [...state.views, view],
  selected: view,
})

export const withSheetViewClosed = (state: SheetViews, view: SubView): SheetViews => {
  const index = state.views.findIndex((open) => sameSubView(open, view))
  if (index === -1) return state
  const views = state.views.filter((_, i) => i !== index)
  const wasSelected = state.selected !== null && sameSubView(state.selected, view)
  return {
    views,
    selected: wasSelected ? (views[index] ?? views[index - 1] ?? null) : state.selected,
  }
}
