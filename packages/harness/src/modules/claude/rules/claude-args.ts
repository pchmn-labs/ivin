import type { RunOptions } from "@ivin/contracts/session"

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
  "--permission-prompt-tool",
  "stdio",
]

export const claudeArgs = (
  { model, effort, permissionMode }: RunOptions,
  providerSessionId: string | null,
) => [
  ...ARGS,
  "--model",
  model,
  "--effort",
  effort,
  "--permission-mode",
  permissionMode,
  ...(providerSessionId === null ? [] : ["--resume", providerSessionId]),
]
