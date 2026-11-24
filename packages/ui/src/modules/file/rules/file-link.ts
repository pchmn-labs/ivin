export interface LineRange {
  readonly start: number
  readonly end: number
}

export type FileLink =
  | { readonly kind: "file"; readonly path: string; readonly lines?: LineRange }
  | { readonly kind: "outside"; readonly path: string; readonly lines?: LineRange }
  | { readonly kind: "none" }

const NONE: FileLink = { kind: "none" }
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
const FILE_URL = /^file:\/\/(?:localhost)?(?=\/)/
const NAME_AND_LINE = /^[^:/]+:\d+(?::\d+|-\d+)?$/
const LINE_SUFFIX = /:(\d+)(?::\d+|-(\d+))?$/
const LINE_FRAGMENT = /^L(\d+)(?:C\d+)?(?:-L?(\d+)(?:C\d+)?)?$/

const splitHref = (href: string) => {
  const [beforeHash = "", fragment = ""] = href.split(/#(.*)/s)
  return { target: beforeHash.split("?")[0]!, fragment }
}

// What reads as a scheme to a URL parser but names a file: `file:///…`, `Makefile:12`.
export const hasFileScheme = (href: string) => {
  const { target } = splitHref(href)
  return FILE_URL.test(target) || NAME_AND_LINE.test(target)
}

const range = (start: string, end: string | undefined): LineRange => {
  const [a, b] = [Number(start), Number(end ?? start)]
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

const normalized = (absolute: string) => {
  const segments: Array<string> = []
  for (const segment of absolute.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return `/${segments.join("/")}`
}

const decoded = (text: string) => {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

export const fileLink = (href: string, workingFolder: string): FileLink => {
  let { target, fragment } = splitHref(href)
  const fileUrl = FILE_URL.exec(target)
  if (fileUrl) target = target.slice(fileUrl[0].length)
  else if (SCHEME.test(target) && !NAME_AND_LINE.test(target)) return NONE

  const suffix = LINE_SUFFIX.exec(target)
  const fromFragment = LINE_FRAGMENT.exec(fragment)
  const lines = suffix
    ? range(suffix[1]!, suffix[2])
    : fromFragment
      ? range(fromFragment[1]!, fromFragment[2])
      : undefined
  if (suffix) target = target.slice(0, suffix.index)

  const path = decoded(target)
  if (path === null || path === "") return NONE
  const folder = normalized(workingFolder)
  const absolute = normalized(path.startsWith("/") ? path : `${folder}/${path}`)
  if (absolute === folder) return NONE
  const inside = absolute.startsWith(`${folder}/`)
  const found = inside
    ? ({ kind: "file", path: absolute.slice(folder.length + 1) } as const)
    : ({ kind: "outside", path: absolute } as const)
  return lines ? { ...found, lines } : found
}

export const isOutsidePath = (path: string): boolean => path.startsWith("/")

const URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//
const LINE_TAIL = /(?::\d+(?::\d+|-\d+)?|#L\d+(?:-L?\d+)?)$/
const NOT_IN_PATH = /[\s()<>{}[\]'"`,;:&|=*?$!#\\^]/
const EXTENSION = /\.[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*$/
// Common top-level domains only: `.md`, `.sh` or `.app` are file extensions as often as domains.
const DOMAIN =
  /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|net|org|io|dev|co|fr|de|uk|eu|edu|gov|info|me)(?::\d+)?(?:\/\S*)?$/i

export type ListedFiles =
  | { readonly paths: ReadonlySet<string>; readonly truncated: boolean }
  | "loading"
  | "unreadable"

export type InlineCodeTarget =
  | { readonly kind: "file" }
  | { readonly kind: "web"; readonly url: string }
  | { readonly kind: "code" }

const FILE: InlineCodeTarget = { kind: "file" }
const CODE: InlineCodeTarget = { kind: "code" }

const pathPart = (code: string): string | null => {
  const target = (code.startsWith("file://") ? code.slice(7) : code).replace(LINE_TAIL, "")
  if (URL_SCHEME.test(target) || NOT_IN_PATH.test(target) || /^[@~]/.test(target)) return null
  return /[a-zA-Z]/.test(target) ? target : null
}

const isPathShaped = (target: string) => target.includes("/") || EXTENSION.test(target)

export const inlineCodeTarget = (
  code: string,
  workingFolder: string,
  files: ListedFiles,
): InlineCodeTarget => {
  const target = pathPart(code)
  const link = target === null ? NONE : fileLink(code, workingFolder)
  if (target !== null && link.kind !== "none") {
    if (target.startsWith("/") || link.kind === "outside") return isPathShaped(target) ? FILE : CODE
    if (files === "unreadable" || (files !== "loading" && files.truncated))
      return isPathShaped(target) ? FILE : CODE
    if (files !== "loading" && files.paths.has(link.path)) return FILE
  }
  return files !== "loading" && DOMAIN.test(code) ? { kind: "web", url: `https://${code}` } : CODE
}
