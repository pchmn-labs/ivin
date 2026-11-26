import { Effect } from "effect"
import { type Command, UsageError } from "./command.ts"
import { Server } from "./connection.ts"
import { pluginIdOf, pluginNotFound } from "./plugin-id.ts"

const setEnabledCommand = (enabled: boolean): Command => {
  const verb = enabled ? "enable" : "disable"
  return {
    name: `plugin ${verb}`,
    summary: enabled
      ? "Turn a disabled plugin on again"
      : "Turn a plugin off: neither its UI half nor its server half loads",
    usage: `ivin plugin ${verb} <id>`,
    description: enabled
      ? "Loads both halves of a plugin that was disabled, in the window and in the plugin host. The choice is kept across relaunches."
      : "Unloads both halves of the plugin, in the window and in the plugin host, whether it is built in, in ~/.ivin/plugins or in a trusted project. The choice is kept across relaunches; `ivin plugin list` shows the plugin as disabled and `ivin plugin enable <id>` turns it on again.",
    options: {},
    maxArguments: 1,
    timeLimitSeconds: 60,
    check: (input) => {
      const id = pluginIdOf(input, verb)
      return id instanceof UsageError ? id : null
    },
    run: (input) =>
      Effect.gen(function* () {
        const id = pluginIdOf(input, verb)
        if (id instanceof UsageError) return yield* id
        const { client } = yield* Server
        yield* client["plugin.setEnabled"]({ id, enabled }).pipe(
          Effect.catchTag("PluginNotFound", () => pluginNotFound(id)),
        )
        return {
          ok: true,
          text: `${enabled ? "Enabled" : "Disabled"} plugin ${id}.`,
          json: { plugin: { id, enabled } },
        }
      }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
  }
}

export const pluginDisable = setEnabledCommand(false)
export const pluginEnable = setEnabledCommand(true)
