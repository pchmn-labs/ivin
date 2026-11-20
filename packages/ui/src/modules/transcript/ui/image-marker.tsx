import { useAtom } from "@effect/atom-react"
import { useState } from "react"
import { hoveredImageAtom } from "../atoms/image-viewer.ts"
import { ImagePreview } from "./image-preview.tsx"
import { StoredImage } from "./stored-image.tsx"
import "./image-marker.css"

export function ImageMarker({
  imageId,
  number,
  onOpen,
}: {
  imageId: string
  number: number
  onOpen: () => void
}) {
  const [hovered, setHovered] = useAtom(hoveredImageAtom)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const show = (element: HTMLElement) => {
    setAnchor(element)
    setHovered(imageId)
  }
  const hide = () => {
    setAnchor(null)
    setHovered((now) => (now === imageId ? null : now))
  }
  return (
    <>
      <button
        type="button"
        className="iv-image-marker"
        data-hot={hovered === imageId || undefined}
        aria-label={`View image #${number}`}
        onClick={onOpen}
        onPointerEnter={(event) => show(event.currentTarget)}
        onPointerLeave={hide}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={hide}
      >
        <span className="iv-image-marker__image">
          <StoredImage imageId={imageId} />
        </span>
        #{number}
      </button>
      {anchor && <ImagePreview anchor={anchor} imageId={imageId} number={number} />}
    </>
  )
}
