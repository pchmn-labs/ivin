const ARGS = [
  "-p",
  "--output-format",
  "stream-json",
  "--input-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  // Without it the thinking blocks come back empty.
  "--thinking-display",
  "summarized",
]

export const claudeArgs = (model: string, providerSessionId: string | null) => [
  ...ARGS,
  "--model",
  model,
  ...(providerSessionId === null ? [] : ["--resume", providerSessionId]),
]
