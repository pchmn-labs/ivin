import type { SubView, TabSubViews } from "@ivin/contracts/tab"

export const sameSubView = (a: SubView, b: SubView) => a.kind === b.kind && a.path === b.path

export const subViewKey = (subView: SubView) => `${subView.kind}:${subView.path}`

export const withSubViewOpen = (state: TabSubViews, subView: SubView): TabSubViews => ({
  ...state,
  subViews: state.subViews.some((open) => sameSubView(open, subView))
    ? state.subViews
    : [...state.subViews, subView],
  selected: subView,
  sessionTabSelected: false,
})

export const withFullWidth = (state: TabSubViews, fullWidth: boolean): TabSubViews => ({
  ...state,
  fullWidth,
  sessionTabSelected: fullWidth && state.sessionTabSelected,
})

export const withSessionTabSelected = (state: TabSubViews): TabSubViews => ({
  ...state,
  sessionTabSelected: state.fullWidth,
})

export type RowTab = SubView | "session"

// Goes round the row: the Session tab first in full width, then the files in order.
export const adjacentRowTab = (state: TabSubViews, step: 1 | -1): RowTab | null => {
  if (state.selected === null) return null
  const row: RowTab[] = state.fullWidth ? ["session", ...state.subViews] : [...state.subViews]
  const selected = state.selected
  const current = state.sessionTabSelected
    ? 0
    : row.findIndex((tab) => tab !== "session" && sameSubView(tab, selected))
  return row[(current + step + row.length) % row.length] ?? null
}

export const withSubViewClosed = (state: TabSubViews, subView: SubView): TabSubViews => {
  const index = state.subViews.findIndex((open) => sameSubView(open, subView))
  if (index === -1) return state
  const subViews = state.subViews.filter((_, i) => i !== index)
  const wasSelected = state.selected !== null && sameSubView(state.selected, subView)
  return {
    ...state,
    subViews,
    selected: wasSelected ? (subViews[index] ?? subViews[index - 1] ?? null) : state.selected,
  }
}
