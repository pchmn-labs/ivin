import { useAtom } from "@effect/atom-react"
import { useState } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { hoveredImageAtom } from "../atoms/image-viewer.ts"
import { ImagePreview } from "./image-preview.tsx"
import "./image-marker.css"

export function ImageMarker({
  imageId,
  number,
  src,
  deleted = false,
  onOpen,
}: {
  imageId: string
  number: number
  src: string
  deleted?: boolean
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
        data-deleted={deleted || undefined}
        aria-label={deleted ? `Image #${number}, deleted` : `View image #${number}`}
        onClick={onOpen}
        onPointerEnter={(event) => show(event.currentTarget)}
        onPointerLeave={hide}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={hide}
      >
        <span className="iv-image-marker__image">
          {deleted ? <Icon name="image-broken" size={12} /> : <img src={src} alt="" />}
        </span>
        #{number}
      </button>
      {anchor && !deleted && <ImagePreview anchor={anchor} number={number} src={src} />}
    </>
  )
}
