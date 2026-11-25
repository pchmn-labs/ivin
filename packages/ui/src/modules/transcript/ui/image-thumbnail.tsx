import { useAtom } from "@effect/atom-react"
import { useRef } from "react"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { useInView } from "../hooks/use-in-view.ts"
import { hoveredImageAtom } from "../atoms/image-viewer.ts"
import "./image-thumbnail.css"

export interface ImageThumbnailProps {
  readonly imageId: string
  readonly number: number
  readonly size: "sm" | "md" | "lg"
  readonly src: string
  readonly showNumber?: boolean
  readonly current?: boolean
  readonly deleted?: boolean
  // Loads the image only once the thumbnail scrolls into view, for a list that is not virtual.
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
  deleted = false,
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
      data-deleted={deleted || undefined}
      aria-label={deleted ? `Image #${number}, deleted` : `View image #${number}`}
      aria-current={current}
      onClick={onOpen}
      onPointerEnter={() => setHovered(imageId)}
      onPointerLeave={() => setHovered((now) => (now === imageId ? null : now))}
    >
      {deleted ? (
        <span className="iv-image-thumbnail__deleted">
          <Icon name="image-broken" size={size === "sm" ? 14 : 20} />
          {size === "lg" && "Deleted"}
        </span>
      ) : (
        visible && <img src={src} alt="" decoding="async" />
      )}
      {showNumber && <span className="iv-image-thumbnail__number">#{number}</span>}
    </button>
  )
}
