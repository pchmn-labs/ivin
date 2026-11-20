export const clampSize = (size: number, min: number, max: number) =>
  Math.round(Math.min(Math.max(size, min), Math.max(min, max)))

// A handle on a top edge grows its target when dragged up; one on a right edge, when dragged right.
export const draggedSize = (
  start: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  edge: "right" | "top",
) => (edge === "right" ? start + to.x - from.x : start + from.y - to.y)
