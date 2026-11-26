import { errorTag } from "../../../shared/rules/error-tag.ts"

export const commandFailureMessage = (error: unknown, command: string): string => {
  if (errorTag(error) === "CommandNotFound") return `The command ${command} is not available.`
  if (errorTag(error) === "CommandFailed") return (error as { reason: string }).reason
  return `The command ${command} could not run.`
}
