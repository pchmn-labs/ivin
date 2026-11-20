import type { UserMessage } from "../../../shared/harness-provider.ts"

export const userMessageLine = ({ text, images }: UserMessage): string =>
  JSON.stringify({
    type: "user",
    message: {
      role: "user",
      content: [
        ...images.map(({ mediaType, base64 }) => ({
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64 },
        })),
        // Claude refuses an empty text block.
        ...(text === "" ? [] : [{ type: "text", text }]),
      ],
    },
  })
