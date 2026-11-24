import {
  FILE_SIZE_LIMIT,
  type FileContent,
  FileNotRead,
  IMAGE_SIZE_LIMIT,
} from "@ivin/contracts/file"
import { Effect } from "effect"
import { Base64 } from "effect/encoding"
import { isBinary } from "../rules/binary-content.ts"
import { imageMimeType } from "../rules/image-type.ts"
import { contentVersion } from "./content-version.ts"
import { FileReader } from "./file-reader.ts"

export const readContent = (sessionId: string, requestedPath: string, resolvedPath: string) =>
  Effect.gen(function* () {
    const toError = ({ reason }: { reason: "missing" | "unreadable" }) =>
      new FileNotRead({ sessionId, path: requestedPath, reason })
    const reader = yield* FileReader
    const mimeType = imageMimeType(requestedPath)
    const limit = mimeType === null ? FILE_SIZE_LIMIT : IMAGE_SIZE_LIMIT
    const size = yield* reader.size(resolvedPath).pipe(Effect.mapError(toError))
    if (size > limit) return { kind: "too_large", size, limit } satisfies FileContent
    const bytes = yield* reader.read(resolvedPath).pipe(Effect.mapError(toError))
    if (mimeType !== null) {
      return {
        kind: "image",
        mimeType,
        data: Base64.encode(bytes),
        version: yield* contentVersion(bytes),
      } satisfies FileContent
    }
    if (isBinary(bytes)) return { kind: "binary" } satisfies FileContent
    return {
      kind: "text",
      text: new TextDecoder().decode(bytes),
      version: yield* contentVersion(bytes),
    } satisfies FileContent
  })
