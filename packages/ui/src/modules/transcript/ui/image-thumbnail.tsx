import { useAtom } from "@effect/atom-react"
import { hoveredImageAtom } from "../atoms/image-viewer.ts"
import { StoredImage } from "./stored-image.tsx"
import "./image-thumbnail.css"

export interface ImageThumbnailProps {
  readonly imageId: string
  readonly number: number
  readonly size: "sm" | "md" | "lg"
  // An image not stored yet, such as a draft's.
  readonly src?: string
  readonly showNumber?: boolean
  readonly current?: boolean
  readonly onOpen: () => void
}

export function ImageThumbnail({
  imageId,
  number,
  size,
  src,
  showNumber = false,
  current,
  onOpen,
}: ImageThumbnailProps) {
  const [hovered, setHovered] = useAtom(hoveredImageAtom)
  return (
    <button
      type="button"
      className="iv-image-thumbnail"
      data-size={size}
      data-hot={(hovered === imageId && size !== "sm") || undefined}
      aria-label={`View image #${number}`}
      aria-current={current}
      onClick={onOpen}
      onPointerEnter={() => setHovered(imageId)}
      onPointerLeave={() => setHovered((now) => (now === imageId ? null : now))}
    >
      {src === undefined ? <StoredImage imageId={imageId} /> : <img src={src} alt="" />}
      {showNumber && <span className="iv-image-thumbnail__number">#{number}</span>}
    </button>
  )
}
