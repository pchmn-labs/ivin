import { Effect } from "effect"
import type { Command } from "./command.ts"
import { Server } from "./connection.ts"

export const pluginList: Command = {
  name: "plugin list",
  summary: "List the plugins and whether each half is active, failed or disabled",
  usage: "ivin plugin list",
  description:
    "Prints one line per plugin in ~/.ivin/plugins/, with the state of its UI half and of its server half: active, failed, disabled (the plugin host stopped running it, or there is none), or none when the plugin has no such half. `ivin plugin logs <id>` says why a half failed or was disabled.",
  options: {},
  maxArguments: 0,
  run: () =>
    Effect.gen(function* () {
      const { client } = yield* Server
      const plugins = yield* client["plugin.status"]()
      const width = Math.max(0, ...plugins.map(({ id }) => id.length))
      return {
        ok: true,
        text:
          plugins.length === 0
            ? "No plugin in ~/.ivin/plugins."
            : plugins
                .map(({ id, ui, server }) => `${id.padEnd(width)}  ui: ${ui}  server: ${server}`)
                .join("\n"),
        json: { plugins },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
