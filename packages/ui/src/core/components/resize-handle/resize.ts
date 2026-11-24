export const clampSize = (size: number, min: number, max: number) =>
  Math.round(Math.min(Math.max(size, min), Math.max(min, max)))

export type Edge = "left" | "right" | "top"

export const draggedSize = (
  start: number,
  from: { readonly x: number; readonly y: number },
  to: { readonly x: number; readonly y: number },
  edge: Edge,
) => {
  if (edge === "right") return start + to.x - from.x
  if (edge === "left") return start + from.x - to.x
  return start + from.y - to.y
}
