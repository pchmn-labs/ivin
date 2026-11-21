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
  return typeof args === "string" && args !== "" ? `/${skill} ${args}` : `/${skill}`
}

export const mainArgument = (name: string, input: unknown): string | null => {
  if (name === "Skill" && typeof input === "object" && input !== null)
    return skillArgument(input as Record<string, unknown>)
  const key = MAIN_ARGUMENT[name]
  if (key === undefined || typeof input !== "object" || input === null) return null
  const value = (input as Record<string, unknown>)[key]
  return typeof value === "string" ? value : null
}

export const prettyInput = (input: unknown): string => JSON.stringify(input, null, 2) ?? ""
