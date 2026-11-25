import { Effect } from "effect"
import { imageSelection } from "./image-selection.ts"
import { ImageStore } from "./image-store.ts"

export const getImageSpace = (selection: Parameters<typeof imageSelection>[0]) =>
  Effect.gen(function* () {
    return yield* (yield* ImageStore).space(yield* imageSelection(selection))
  })
