import type { MessageTextProps } from "@ivin/plugin-api/ui"
import { messageParts } from "../rules/message-parts.ts"
import { ImageMarker } from "./image-marker.tsx"
import { useOpenSessionImage } from "./message-images.tsx"
import "./message-images.css"

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
