import { useLayoutEffect, useRef, useState } from "react"
import { readStoredSize, storeSize } from "../adapters/stored-size.ts"
import { clampSize, draggedSize } from "../rules/resize.ts"
import "./resize-handle.css"

const KEY_STEP = 16

export function ResizeHandle({
  label,
  edge,
  property,
  name,
  min,
  max,
}: {
  label: string
  // The edge of its parent the handle sits on; the parent is what it resizes.
  edge: "right" | "top"
  // The CSS custom property on the parent that its stylesheet sizes it by.
  property: string
  // Where the size is remembered between launches.
  name: string
  min: number
  max: (element: HTMLElement) => number
}) {
  const [size, setSize] = useState(() => readStoredSize(name))
  const handle = useRef<HTMLDivElement>(null)
  const target = () => handle.current?.parentElement ?? null

  useLayoutEffect(() => {
    const element = handle.current?.parentElement
    if (element == null) return
    if (size === null) element.style.removeProperty(property)
    else element.style.setProperty(property, `${size}px`)
  }, [property, size])

  const current = (element: HTMLElement) => {
    const box = element.getBoundingClientRect()
    return edge === "right" ? box.width : box.height
  }
  const apply = (element: HTMLElement, next: number) => {
    const clamped = clampSize(next, min, max(element))
    element.style.setProperty(property, `${clamped}px`)
    return clamped
  }
  const commit = (next: number | null) => {
    storeSize(name, next)
    setSize(next)
  }

  return (
    <div
      ref={handle}
      className="iv-resize-handle"
      data-edge={edge}
      role="separator"
      aria-label={label}
      aria-orientation={edge === "right" ? "vertical" : "horizontal"}
      aria-valuemin={min}
      aria-valuenow={size ?? undefined}
      tabIndex={0}
      onPointerDown={(event) => {
        const element = target()
        if (element === null || event.button !== 0) return
        event.preventDefault()
        const handle = event.currentTarget
        handle.setPointerCapture(event.pointerId)
        const start = current(element)
        const from = { x: event.clientX, y: event.clientY }
        let last = start
        const move = (e: PointerEvent) => {
          last = apply(element, draggedSize(start, from, { x: e.clientX, y: e.clientY }, edge))
        }
        const end = () => {
          handle.removeEventListener("pointermove", move)
          handle.removeEventListener("pointerup", end)
          handle.removeEventListener("pointercancel", end)
          handle.removeAttribute("data-dragging")
          commit(last)
        }
        handle.setAttribute("data-dragging", "")
        handle.addEventListener("pointermove", move)
        handle.addEventListener("pointerup", end)
        handle.addEventListener("pointercancel", end)
      }}
      onDoubleClick={() => commit(null)}
      onKeyDown={(event) => {
        const element = target()
        if (element === null) return
        const grow = edge === "right" ? "ArrowRight" : "ArrowUp"
        const shrink = edge === "right" ? "ArrowLeft" : "ArrowDown"
        if (event.key !== grow && event.key !== shrink) return
        event.preventDefault()
        const step = event.key === grow ? KEY_STEP : -KEY_STEP
        commit(apply(element, current(element) + step))
      }}
    />
  )
}
