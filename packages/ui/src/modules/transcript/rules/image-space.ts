import type { ImageSpace } from "@ivin/contracts/transcript"
import { byteSize } from "../../../shared/rules/byte-size.ts"

// `null`: every image.
export type DeleteScope = number | null

const count = (n: number, one: string) => `${n.toLocaleString("en")} ${one}${n === 1 ? "" : "s"}`

export const imageCount = (n: number) => count(n, "image")

export const storedImagesSummary = (space: ImageSpace) =>
  space.images === 0 ? "No image is stored." : imageCount(space.images)

export const olderImagesSummary = (space: ImageSpace, days: number) =>
  space.images === 0
    ? `No image is older than ${count(days, "day")}.`
    : `${imageCount(space.images)} · ${byteSize(space.bytes)}`

export const deleteImagesTitle = (scope: DeleteScope, space: ImageSpace) =>
  scope === null
    ? `Delete all ${imageCount(space.images)}?`
    : `Delete ${imageCount(space.images)} sent more than ${count(scope, "day")} ago?`

export const deleteImagesDescription = (space: ImageSpace) =>
  `This frees ${byteSize(space.bytes)}. Their messages keep their text and show each image as deleted. This cannot be undone.`

export const DAYS_INVALID = "Enter a whole number of days, 1 or more."
export const SPACE_NOT_READ = "The space the images take could not be read. Try again."
export const IMAGES_NOT_DELETED = "The images could not be deleted. Try again."
