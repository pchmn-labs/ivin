import type { ImageData } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { imageDataUrl } from "../rules/image-url.ts"

// A message's images show at once, before the server has stored them, until its send ends.
const sent = new Map<string, string>()

export const rememberSentImages = (images: ReadonlyArray<ImageData>) => {
  for (const image of images) sent.set(image.id, imageDataUrl(image))
}

export const forgetSentImages = (images: ReadonlyArray<ImageData>) => {
  for (const image of images) sent.delete(image.id)
}

// Read by a mounted thumbnail only, so the transcript's virtual list loads the images on screen.
export const imageUrlOf = Atom.family((imageId: string) =>
  serverRuntime.atom(
    Effect.gen(function* () {
      const local = sent.get(imageId)
      if (local !== undefined) return local
      const client = yield* ServerClient
      return imageDataUrl(yield* client["transcript.getImage"]({ imageId }))
    }),
  ),
)
