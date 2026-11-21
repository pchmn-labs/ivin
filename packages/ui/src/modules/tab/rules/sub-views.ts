import type { SubView, TabSubViews } from "@ivin/contracts/tab"

export const sameSubView = (a: SubView, b: SubView) => a.kind === b.kind && a.path === b.path

export const subViewKey = (subView: SubView) => `${subView.kind}:${subView.path}`

export const withSubViewOpen = (state: TabSubViews, subView: SubView): TabSubViews => ({
  ...state,
  subViews: state.subViews.some((open) => sameSubView(open, subView))
    ? state.subViews
    : [...state.subViews, subView],
  selected: subView,
})

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
