import { Effect, type Schema } from "effect"
import { CommandFailed, type Command, type Input, UsageError } from "./command.ts"
import { Server } from "./connection.ts"

const argumentsOf = ({ positionals, values }: Input) => {
  const command = positionals[0]?.trim() ?? ""
  if (command === "") return new UsageError({ message: "ivin run needs a command." })
  const text = values["args"]
  if (typeof text !== "string") return { command, args: null as Schema.Json }
  try {
    return { command, args: JSON.parse(text) as Schema.Json }
  } catch {
    return new UsageError({ message: "ivin run --args needs JSON." })
  }
}

export const runPluginCommand: Command = {
  name: "run",
  summary: "Run a plugin's command",
  usage: "ivin run <command> [--args <json>]",
  description:
    "Runs a command a plugin registered, with the JSON given to --args, and prints its result as JSON.",
  options: {
    args: { type: "string", value: "json", description: "The command's arguments, as JSON" },
  },
  maxArguments: 1,
  timeLimitSeconds: 300,
  check: (input) => {
    const parsed = argumentsOf(input)
    return parsed instanceof UsageError ? parsed : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const parsed = argumentsOf(input)
      if (parsed instanceof UsageError) return yield* parsed
      const { command, args } = parsed
      const { client } = yield* Server
      const result = yield* client["plugin.run"]({ command, args }).pipe(
        Effect.catchTags({
          CommandNotFound: () =>
            Effect.fail(
              new CommandFailed({
                reason: "commandNotFound",
                message: `No plugin registered the command ${command}.`,
              }),
            ),
          CommandFailed: ({ reason }) =>
            Effect.fail(
              new CommandFailed({
                reason: "commandFailed",
                message: `The command ${command} failed: ${reason}`,
              }),
            ),
        }),
      )
      return { ok: true, text: JSON.stringify(result), json: { command, result } }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
