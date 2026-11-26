import type { ErrorReport } from "@ivin/contracts/log"
import { pluginBundleUrl } from "../../plugin/rules/plugin-bundle-url.ts"

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

const locationOf = (filename: string | undefined, error: unknown): ReadonlyArray<string> => {
  const firstFrame = field(error, "stack")
    ?.split("\n")
    .find((line) => /^\s*at |@/.test(line))
  return [filename, firstFrame].filter((location) => location !== undefined)
}

export const pluginOfError = (
  filename: string | undefined,
  error: unknown,
  bundles: ReadonlyMap<string, string>,
): string | null => {
  for (const location of locationOf(filename, error))
    for (const [bundle, id] of bundles) {
      if (location.includes(pluginBundleUrl(bundle, false))) return id
      if (location.includes(pluginBundleUrl(bundle, true))) return id
    }
  return null
}
