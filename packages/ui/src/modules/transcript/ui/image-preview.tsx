import { PreviewCard } from "@base-ui/react/preview-card"
import "./image-preview.css"

// Mounted while the pointer is on the anchor; above it, or under it when there is no room.
export function ImagePreview({
  anchor,
  number,
  src,
}: {
  anchor: Element
  number: number
  src: string
}) {
  return (
    <PreviewCard.Root open>
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          anchor={anchor}
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={8}
        >
          <PreviewCard.Popup className="iv-image-preview" aria-hidden="true">
            <img src={src} alt="" />
            <div className="iv-image-preview__label">Image #{number}</div>
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
