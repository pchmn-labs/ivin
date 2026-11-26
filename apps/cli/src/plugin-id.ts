import { Effect } from "effect"
import { CommandFailed, type Input, UsageError } from "./command.ts"

export const pluginIdOf = (input: Input, command: string) => {
  const id = input.positionals[0]?.trim() ?? ""
  return id === "" ? new UsageError({ message: `ivin plugin ${command} needs a plugin id.` }) : id
}

export const pluginNotFound = (id: string) =>
  Effect.fail(
    new CommandFailed({
      reason: "pluginNotFound",
      message: `No plugin in ~/.ivin/plugins has the id ${id}.`,
    }),
  )
