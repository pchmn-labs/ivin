import { useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { StoredImage } from "./stored-image.tsx"
import "./image-preview.css"

const GAP = 8
const WIDTH = 240

// Above the anchor, or under it when the window has no room above.
export function ImagePreview({
  anchor,
  imageId,
  number,
  src,
}: {
  anchor: Element
  imageId: string
  number: number
  src?: string
}) {
  const card = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = card.current
    if (!element) return
    const box = anchor.getBoundingClientRect()
    const below = box.top < element.offsetHeight + GAP * 2
    element.dataset.side = below ? "bottom" : "top"
    element.style.left = `${Math.max(GAP, Math.min(box.left, window.innerWidth - WIDTH - GAP))}px`
    element.style.top = below
      ? `${box.bottom + GAP}px`
      : `${box.top - element.offsetHeight - GAP}px`
  })
  return createPortal(
    <div ref={card} className="iv-image-preview" aria-hidden="true">
      {src === undefined ? <StoredImage imageId={imageId} /> : <img src={src} alt="" />}
      <div className="iv-image-preview__label">Image #{number}</div>
    </div>,
    document.body,
  )
}
