import { ImageNotFound } from "@ivin/contracts/transcript"
import { Effect } from "effect"
import { ImageStore } from "./image-store.ts"

export const getImage = (imageId: string) =>
  Effect.gen(function* () {
    const image = yield* (yield* ImageStore).find(imageId)
    return image ?? (yield* new ImageNotFound({ imageId }))
  })
