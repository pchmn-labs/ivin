import { Effect } from "effect"
import { CommandFailed, type Command, UsageError } from "./command.ts"
import { Server } from "./connection.ts"
import { pluginIdOf } from "./plugin-id.ts"

export const pluginNew: Command = {
  name: "plugin new",
  summary: "Create a plugin with a UI half and a server half that each do one visible thing",
  usage: "ivin plugin new <id>",
  description:
    "Creates ~/.ivin/plugins/<id>/ with package.json, a tsconfig.json that resolves `@ivin/plugin-api` to ivin's types, a README, src/ui.tsx (a line at the bottom of the sidebar) and src/server.ts (two log lines). ivin loads it at once. Edit the files and ivin reloads the plugin; `ivin plugin check <id>` type-checks it and `ivin plugin logs <id>` prints what it logged.",
  options: {},
  maxArguments: 1,
  check: (input) => {
    const id = pluginIdOf(input, "new")
    return id instanceof UsageError ? id : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const id = pluginIdOf(input, "new")
      if (id instanceof UsageError) return yield* id
      const { client } = yield* Server
      const path = yield* client["plugin.create"]({ id }).pipe(
        Effect.catchTag("PluginNotCreated", ({ reason }) =>
          Effect.fail(
            new CommandFailed({
              reason: "notCreated",
              message: `Could not create plugin ${id}: ${reason}`,
            }),
          ),
        ),
      )
      return { ok: true, text: `Created plugin ${id} in ${path}.`, json: { id, path } }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
