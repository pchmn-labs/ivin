import { useAtom } from "@effect/atom-react"
import { useRef } from "react"
import { useInView } from "../hooks/use-in-view.ts"
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
  // Fetches the image only once the thumbnail scrolls into view, for a list that is not virtual.
  readonly lazy?: boolean
  readonly onOpen: () => void
}

export function ImageThumbnail({
  imageId,
  number,
  size,
  src,
  showNumber = false,
  current,
  lazy = false,
  onOpen,
}: ImageThumbnailProps) {
  const [hovered, setHovered] = useAtom(hoveredImageAtom)
  const button = useRef<HTMLButtonElement>(null)
  const visible = useInView(button, lazy)
  return (
    <button
      ref={button}
      type="button"
      className="iv-image-thumbnail"
      data-image-id={imageId}
      data-size={size}
      data-hot={(hovered === imageId && size !== "sm") || undefined}
      aria-label={`View image #${number}`}
      aria-current={current}
      onClick={onOpen}
      onPointerEnter={() => setHovered(imageId)}
      onPointerLeave={() => setHovered((now) => (now === imageId ? null : now))}
    >
      {src !== undefined ? <img src={src} alt="" /> : visible && <StoredImage imageId={imageId} />}
      {showNumber && <span className="iv-image-thumbnail__number">#{number}</span>}
    </button>
  )
}
