import type { ErrorReport } from "@ivin/contracts/log"

const field = (value: unknown, key: string): string | undefined => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  const found = (value as Record<string, unknown>)[key]
  return typeof found === "string" && found !== "" ? found : undefined
}

export const errorReport = (action: string, error: unknown): ErrorReport => {
  const stack = field(error, "stack")
  return {
    action,
    type: field(error, "_tag") ?? field(error, "name") ?? typeof error,
    message:
      field(error, "message") ??
      (typeof error === "object" && error !== null ? JSON.stringify(error) : String(error)),
    ...(stack === undefined ? {} : { stack }),
  }
}

// Matches unbundled plugin sources only: the packaged build merges plugins into the app bundle.
const pluginPath = /\/plugins\/[^/]+\//

export const thrownByPlugin = (filename: string | undefined, error: unknown): boolean => {
  if (filename !== undefined && pluginPath.test(filename)) return true
  const firstFrame = field(error, "stack")
    ?.split("\n")
    .find((line) => /^\s*at |@/.test(line))
  return firstFrame !== undefined && pluginPath.test(firstFrame)
}
