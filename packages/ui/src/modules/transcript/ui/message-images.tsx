import { useAtomSet } from "@effect/atom-react"
import type { MessageImagesProps, MessageTextProps } from "@ivin/plugin-api/ui"
import { imageViewerAtom } from "../atoms/image-viewer.ts"
import { messageParts } from "../rules/message-parts.ts"
import { ImageMarker } from "./image-marker.tsx"
import { ImageThumbnail } from "./image-thumbnail.tsx"
import "./message-images.css"

const useOpenSessionImage = (sessionId: string) => {
  const open = useAtomSet(imageViewerAtom)
  return (imageId: string) => open({ sessionId, images: "session", imageId })
}

export function MessageImages({ sessionId, images }: MessageImagesProps) {
  const openImage = useOpenSessionImage(sessionId)
  if (images.length === 0) return null
  return (
    <div className="iv-message-images">
      {images.map((image) => (
        <ImageThumbnail
          key={image.id}
          imageId={image.id}
          number={image.number}
          size="lg"
          showNumber
          onOpen={() => openImage(image.id)}
        />
      ))}
    </div>
  )
}

export function MessageText({ sessionId, text, images }: MessageTextProps) {
  const openImage = useOpenSessionImage(sessionId)
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
            onOpen={() => openImage(part.image.id)}
          />
        ),
      )}
    </p>
  )
}
