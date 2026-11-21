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
  Agent: "description",
}

const skillArgument = (input: Record<string, unknown>): string | null => {
  const { skill, args } = input
  if (typeof skill !== "string") return null
  const command = `/${skill.replace(/^\//, "")}`
  return typeof args === "string" && args !== "" ? `${command} ${args}` : command
}

export const mainArgument = (name: string, input: unknown): string | null => {
  if (typeof input !== "object" || input === null) return null
  const fields = input as Record<string, unknown>
  if (name === "Skill") return skillArgument(fields)
  const key = MAIN_ARGUMENT[name]
  if (key === undefined) return null
  const value = fields[key]
  return typeof value === "string" ? value : null
}

export const prettyInput = (input: unknown): string => JSON.stringify(input, null, 2) ?? ""
