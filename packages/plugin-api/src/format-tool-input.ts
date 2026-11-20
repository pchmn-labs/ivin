const MAIN_ARGUMENT: Readonly<Record<string, string>> = {
  Bash: "command",
  Edit: "file_path",
  Write: "file_path",
  Read: "file_path",
  MultiEdit: "file_path",
  Grep: "pattern",
  Glob: "pattern",
  WebFetch: "url",
  Task: "description",
}

// The tool argument a person reads first: the command, the path, the pattern.
export const formatToolInput = (name: string, input: unknown): string => {
  const key = MAIN_ARGUMENT[name]
  if (key !== undefined && typeof input === "object" && input !== null) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === "string") return value
  }
  return JSON.stringify(input, null, 2) ?? ""
}
