import { Icon } from "../../../core/components/icon/icon.tsx"
import { imageDataUrl } from "../../transcript/rules/image-url.ts"
import { ImageThumbnail } from "../../transcript/ui/image-thumbnail.tsx"
import type { DraftImage } from "../rules/draft.ts"
import "./draft-images.css"

export function DraftImages({
  images,
  onOpen,
  onRemove,
}: {
  images: ReadonlyArray<DraftImage>
  onOpen: (imageId: string) => void
  onRemove: (number: number) => void
}) {
  if (images.length === 0) return null
  return (
    <div className="iv-draft-images" data-testid="draft-images">
      {images.map((image) => (
        <div key={image.id} className="iv-draft-images__item">
          <ImageThumbnail
            imageId={image.id}
            number={image.number}
            size="md"
            src={imageDataUrl(image)}
            onOpen={() => onOpen(image.id)}
          />
          <button
            type="button"
            className="iv-draft-images__remove"
            aria-label={`Remove image #${image.number}`}
            onClick={() => onRemove(image.number)}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
