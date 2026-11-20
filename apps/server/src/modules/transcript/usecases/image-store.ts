import type { ImageData } from "@ivin/contracts/transcript"
import { Context, type Effect } from "effect"

export class ImageStore extends Context.Service<
  ImageStore,
  {
    readonly save: (sessionId: string, images: readonly ImageData[]) => Effect.Effect<void>
    readonly find: (imageId: string) => Effect.Effect<ImageData | null>
  }
>()("ivin/server/ImageStore") {}
