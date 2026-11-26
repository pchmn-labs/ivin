import { Effect } from "effect"
import { CommandFailed, type Command, UsageError } from "./command.ts"
import { Server } from "./connection.ts"
import { pluginIdOf, pluginNotFound } from "./plugin-id.ts"

export const pluginCheck: Command = {
  name: "plugin check",
  summary: "Type-check a plugin against its tsconfig.json",
  usage: "ivin plugin check <id>",
  description:
    "Runs the TypeScript checker that ships with ivin on the plugin's sources, with `@ivin/plugin-api` resolved to ivin's own types, and prints one line per error: `file(line,column): error TSxxxx: message`. Exits 1 when there is one. The bundler does not type-check, so a plugin with type errors still loads.",
  options: {},
  maxArguments: 1,
  timeLimitSeconds: 120,
  check: (input) => {
    const id = pluginIdOf(input, "check")
    return id instanceof UsageError ? id : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const id = pluginIdOf(input, "check")
      if (id instanceof UsageError) return yield* id
      const { client } = yield* Server
      const errors = yield* client["plugin.check"]({ id }).pipe(
        Effect.catchTags({
          PluginNotFound: () => pluginNotFound(id),
          PluginCheckFailed: ({ reason }) =>
            Effect.fail(
              new CommandFailed({
                reason: "notChecked",
                message: `Could not type-check plugin ${id}: ${reason}`,
              }),
            ),
        }),
      )
      if (errors.length > 0) {
        return yield* new CommandFailed({
          reason: "typeErrors",
          message: errors.join("\n"),
        })
      }
      return { ok: true, text: `Plugin ${id} has no type error.`, json: { id, errors } }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
