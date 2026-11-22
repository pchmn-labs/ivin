export interface LineRange {
  readonly start: number
  readonly end: number
}

export type FileLink =
  | { readonly kind: "file"; readonly path: string; readonly lines?: LineRange }
  | { readonly kind: "outside"; readonly path: string }
  | { readonly kind: "none" }

const NONE: FileLink = { kind: "none" }
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/
const LINE_SUFFIX = /:(\d+)(?::\d+|-(\d+))?$/
const LINE_FRAGMENT = /^L(\d+)(?:C\d+)?(?:-L?(\d+)(?:C\d+)?)?$/

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

const isLineAfterName = (target: string) =>
  LINE_SUFFIX.test(`:${target.slice(target.indexOf(":") + 1)}`)

// What reads as a scheme to a URL parser but names a file: `file://…`, `Makefile:12`.
export const hasFileScheme = (href: string) =>
  href.startsWith("file://") || (SCHEME.test(href) && isLineAfterName(href.split("#")[0]!))

export const fileLink = (href: string, workingFolder: string): FileLink => {
  const hash = href.indexOf("#")
  let target = hash < 0 ? href : href.slice(0, hash)
  const fragment = hash < 0 ? "" : href.slice(hash + 1)
  if (target.startsWith("file://")) target = target.slice("file://".length)
  else if (SCHEME.test(target) && !isLineAfterName(target)) return NONE

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
  if (!absolute.startsWith(`${folder}/`)) {
    return absolute === folder ? NONE : { kind: "outside", path: absolute }
  }
  const relative = absolute.slice(folder.length + 1)
  return lines ? { kind: "file", path: relative, lines } : { kind: "file", path: relative }
}
