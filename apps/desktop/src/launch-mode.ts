export const SAFE_ARGUMENT = "--safe"

export interface LaunchRecord {
  readonly startedAt: number
  readonly settled: boolean
  readonly quit: boolean
}

export type LaunchMode =
  | { readonly kind: "normal" }
  | { readonly kind: "safe"; readonly reason: "forced" | "crash" }

export const parseLaunchRecord = (text: string | null): LaunchRecord | null => {
  if (text === null) return null
  try {
    const value = JSON.parse(text) as Record<string, unknown> | null
    if (
      typeof value?.["startedAt"] === "number" &&
      typeof value["settled"] === "boolean" &&
      typeof value["quit"] === "boolean"
    ) {
      return { startedAt: value["startedAt"], settled: value["settled"], quit: value["quit"] }
    }
  } catch {
    // An unreadable record is no evidence of a crash.
  }
  return null
}

export const launchModeFrom = (
  previous: LaunchRecord | null,
  argv: readonly string[],
): LaunchMode => {
  if (argv.includes(SAFE_ARGUMENT)) return { kind: "safe", reason: "forced" }
  if (previous && !previous.settled && !previous.quit) return { kind: "safe", reason: "crash" }
  return { kind: "normal" }
}
