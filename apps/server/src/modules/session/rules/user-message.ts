import type { PendingMessage } from "@ivin/contracts/session"
import type { HarnessEvent, ImageData } from "@ivin/contracts/transcript"

export interface UserMessage {
  readonly id: string
  readonly text: string
  readonly images: readonly ImageData[]
}

export const unsent = ({ id, text, images }: UserMessage | PendingMessage): PendingMessage => ({
  id,
  text,
  images: images.map(({ id, number, mediaType }) => ({ id, number, mediaType })),
})

export const userMessageEvent = (
  message: UserMessage | PendingMessage,
  steer = false,
): HarnessEvent => ({
  type: "user_message",
  text: message.text,
  images: unsent(message).images,
  // Left out of turn-starting messages, so they are stored as before steers existed.
  steer: steer || undefined,
  raw: null,
})
