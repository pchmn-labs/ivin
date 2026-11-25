import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { MessageImagesProps } from "@ivin/plugin-api/ui"
import { deletedImageIdsAtom } from "../atoms/delete-images.ts"
import { imageViewerAtom } from "../atoms/image-viewer.ts"
import { imageSrc } from "../atoms/sent-images.ts"
import { isImageDeleted } from "../rules/image-deleted.ts"
import { ImageThumbnail } from "./image-thumbnail.tsx"
import "./message-images.css"

export const useOpenSessionImage = (sessionId: string) => {
  const open = useAtomSet(imageViewerAtom)
  return (imageId: string) => open({ sessionId, images: "session", imageId })
}

export function MessageImages({ sessionId, images }: MessageImagesProps) {
  const openImage = useOpenSessionImage(sessionId)
  const deletedIds = useAtomValue(deletedImageIdsAtom)
  if (images.length === 0) return null
  return (
    <div className="iv-message-images">
      {images.map((image) => (
        <ImageThumbnail
          key={image.id}
          imageId={image.id}
          number={image.number}
          src={imageSrc(sessionId, image)}
          size="lg"
          showNumber
          deleted={isImageDeleted(image, deletedIds)}
          onOpen={() => openImage(image.id)}
        />
      ))}
    </div>
  )
}
