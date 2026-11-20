import type { ImageMediaType } from "@ivin/contracts/transcript"

const ACCEPTED: ReadonlyArray<string> = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] satisfies ReadonlyArray<ImageMediaType>

export const isImageMediaType = (type: string): type is ImageMediaType => ACCEPTED.includes(type)

export type ImageRefusal =
  | { readonly name: string; readonly reason: "type" }
  | { readonly name: string; readonly reason: "size"; readonly size: number }

export const imageRefusal = (
  file: { readonly name: string; readonly type: string; readonly size: number },
  maxBytes: number,
): ImageRefusal | null => {
  if (!isImageMediaType(file.type)) return { name: file.name, reason: "type" }
  if (file.size > maxBytes) return { name: file.name, reason: "size", size: file.size }
  return null
}

const megabytes = (bytes: number) => `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`

export const refusalMessage = (
  refused: ReadonlyArray<ImageRefusal>,
  agent: string,
  maxBytes: number,
): string => {
  const [only] = refused
  if (refused.length > 1 || only === undefined)
    return `${refused.length} files were not added: ${agent} takes PNG, JPEG, GIF or WebP images up to ${megabytes(maxBytes)}.`
  return only.reason === "type"
    ? `${only.name} is not an image ${agent} can read. Use PNG, JPEG, GIF or WebP.`
    : `${only.name} is ${megabytes(only.size)}; ${agent} takes images up to ${megabytes(maxBytes)}.`
}
