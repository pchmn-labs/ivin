import type { ToolActivity, ToolOutcome, ToolUse } from "../../../shared/harness-provider.ts"

const FOLDER_SWITCH_TOOLS = new Set(["EnterWorktree", "ExitWorktree"])
// Claude quotes folders as “/path”; ExitWorktree names the worktree it left, then the folder it is back in.
const QUOTED_FOLDER = /“(\/[^”]*)”/g

const commandOf = (input: unknown) =>
  typeof input === "object" &&
  input !== null &&
  "command" in input &&
  typeof input.command === "string"
    ? input.command
    : null

export const toolActivity = (call: ToolUse, result: ToolOutcome): ToolActivity => {
  const command = call.name === "Bash" ? commandOf(call.input) : null
  if (command !== null) return { type: "shell", command }
  const path = FOLDER_SWITCH_TOOLS.has(call.name)
    ? [...result.output.matchAll(QUOTED_FOLDER)].at(-1)?.[1]
    : undefined
  if (path !== undefined) return { type: "folder_switch", path }
  return { type: "other", text: JSON.stringify(call.input) ?? "" }
}
