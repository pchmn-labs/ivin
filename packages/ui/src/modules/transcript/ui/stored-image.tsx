import { useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { Option } from "effect"
import { imageUrlOf } from "../atoms/image.ts"

// Fetches the image when it mounts, and shows nothing until it arrives.
export function StoredImage({ imageId, className }: { imageId: string; className?: string }) {
  const url = Option.getOrUndefined(AsyncResult.value(useAtomValue(imageUrlOf(imageId))))
  return url === undefined ? null : <img className={className} src={url} alt="" />
}
