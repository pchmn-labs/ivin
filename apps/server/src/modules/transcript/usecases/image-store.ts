import type { DeletedImages, ImageData, ImageSpace } from "@ivin/contracts/transcript"
import { type Cause, Context, type Effect } from "effect"

// A null field takes every image; deleted images are never taken.
export interface StoredImageSelection {
  readonly sentBefore: number | null
  readonly exceptSessions: readonly string[] | null
}

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
    readonly space: (selection: StoredImageSelection) => Effect.Effect<ImageSpace>
    readonly remove: (selection: StoredImageSelection) => Effect.Effect<DeletedImages>
    readonly removeSession: (sessionId: string) => Effect.Effect<void>
  }
>()("ivin/server/ImageStore") {}
