import type { ImageData, ImageSpace } from "@ivin/contracts/transcript"
import { type Cause, Context, type Effect } from "effect"

export class ImageStore extends Context.Service<
  ImageStore,
  {
    readonly save: (
      sessionId: string,
      sentAt: number,
      images: readonly ImageData[],
    ) => Effect.Effect<void>
    readonly uncompressed: (sessionId: string) => Effect.Effect<readonly string[]>
    // A failure leaves the file as it was.
    readonly compress: (
      sessionId: string,
      imageId: string,
    ) => Effect.Effect<void, Cause.UnknownError>
    // `sentBefore` null: every image not deleted.
    readonly space: (sentBefore: number | null) => Effect.Effect<ImageSpace>
    readonly remove: (sentBefore: number | null) => Effect.Effect<ImageSpace>
    readonly removeSession: (sessionId: string) => Effect.Effect<void>
  }
>()("ivin/server/ImageStore") {}
