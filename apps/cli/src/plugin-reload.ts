import { Effect } from "effect"
import { type Command, UsageError } from "./command.ts"
import { Server } from "./connection.ts"
import { pluginIdOf, pluginNotFound } from "./plugin-id.ts"

export const pluginReload: Command = {
  name: "plugin reload",
  summary: "Load a plugin's files again without reloading the window",
  usage: "ivin plugin reload <id>",
  description:
    "Compiles both halves of the plugin again, replaces the running UI half in the window and the running server half in the plugin host, and prints the state each reached. ivin does this by itself when a file of the plugin changes; run it to force it. Type errors are written to `ivin plugin logs <id>` and do not stop the load.",
  options: {},
  maxArguments: 1,
  timeLimitSeconds: 60,
  check: (input) => {
    const id = pluginIdOf(input, "reload")
    return id instanceof UsageError ? id : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const id = pluginIdOf(input, "reload")
      if (id instanceof UsageError) return yield* id
      const { client } = yield* Server
      const status = yield* client["plugin.reload"]({ id }).pipe(
        Effect.catchTag("PluginNotFound", () => pluginNotFound(id)),
      )
      return {
        ok: true,
        text: `Reloaded plugin ${id}: ui ${status.ui}, server ${status.server}. \`ivin plugin logs ${id}\` says why a half failed.`,
        json: { plugin: status },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
