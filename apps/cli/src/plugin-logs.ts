import { Effect } from "effect"
import { type Command, type Input, UsageError } from "./command.ts"
import { Server } from "./connection.ts"

const idOf = (input: Input) => {
  const id = input.positionals[0]?.trim() ?? ""
  return id === "" ? new UsageError({ message: "ivin plugin logs needs a plugin id." }) : id
}

export const pluginLogs: Command = {
  name: "plugin logs",
  summary: "Print why a plugin failed to load or to run",
  usage: "ivin plugin logs <id>",
  description:
    "Prints the failures of the plugin with this id, oldest first, one per line with its time: an invalid manifest, a compile error, an import that failed, or an activate function that threw. A plugin whose folder holds no valid id is logged under its folder's name.",
  options: {},
  maxArguments: 1,
  check: (input) => {
    const id = idOf(input)
    return id instanceof UsageError ? id : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const id = idOf(input)
      if (id instanceof UsageError) return yield* id
      const { client } = yield* Server
      const lines = yield* client["plugin.readLog"]({ id })
      return {
        ok: true,
        text: lines.length === 0 ? `Plugin ${id} has logged no failure.` : lines.join("\n"),
        json: { id, lines },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
