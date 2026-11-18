export type ErrorSource = "server" | "ui"

interface ErrorLine {
  readonly time: string
  readonly source: ErrorSource
  readonly action: string
  readonly type: string
  readonly message: string
  readonly stack?: string
}

const field = (value: unknown, key: string): string | undefined => {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined
  const found = (value as Record<string, unknown>)[key]
  return typeof found === "string" && found !== "" ? found : undefined
}

const describeError = (error: unknown): Pick<ErrorLine, "type" | "message" | "stack"> => {
  const stack = field(error, "stack")
  return {
    type: field(error, "_tag") ?? field(error, "name") ?? typeof error,
    message:
      field(error, "message") ??
      (typeof error === "object" && error !== null ? JSON.stringify(error) : String(error)),
    ...(stack === undefined ? {} : { stack }),
  }
}

export const errorLine = (
  date: Date,
  source: ErrorSource,
  action: string,
  error: unknown,
): string =>
  JSON.stringify({
    time: date.toISOString(),
    source,
    action,
    ...describeError(error),
  } satisfies ErrorLine)
