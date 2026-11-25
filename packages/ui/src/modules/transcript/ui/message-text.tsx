import { useAtomValue } from "@effect/atom-react"
import type { MessageTextProps } from "@ivin/plugin-api/ui"
import { deletedImageIdsAtom } from "../atoms/delete-images.ts"
import { imageSrc } from "../atoms/sent-images.ts"
import { isImageDeleted } from "../rules/image-deleted.ts"
import { messageParts } from "../rules/message-parts.ts"
import { ImageMarker } from "./image-marker.tsx"
import { useOpenSessionImage } from "./message-images.tsx"
import "./message-images.css"

export function MessageText({ sessionId, text, images }: MessageTextProps) {
  const openImage = useOpenSessionImage(sessionId)
  const deletedIds = useAtomValue(deletedImageIdsAtom)
  return (
    <p className="iv-message-text">
      {messageParts(text, images).map((part, index) =>
        part.type === "text" ? (
          part.text
        ) : (
          <ImageMarker
            key={index}
            imageId={part.image.id}
            number={part.image.number}
            src={imageSrc(sessionId, part.image)}
            deleted={isImageDeleted(part.image, deletedIds)}
            onOpen={() => openImage(part.image.id)}
          />
        ),
      )}
    </p>
  )
}
