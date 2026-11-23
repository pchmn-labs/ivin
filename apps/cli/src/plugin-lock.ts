import { Effect } from "effect"
import { CommandFailed, type Command, type Input, UsageError } from "./command.ts"
import { Server } from "./connection.ts"

const idOf = (input: Input) => {
  const id = input.positionals[0]?.trim() ?? ""
  return id === "" ? new UsageError({ message: "ivin plugin lock needs a plugin id." }) : id
}

export const pluginLock: Command = {
  name: "plugin lock",
  summary: "Write a plugin's pnpm-lock.yaml from its dependencies",
  usage: "ivin plugin lock <id>",
  description:
    "Resolves the dependencies in the plugin's package.json with the pnpm ivin ships, and writes the versions to pnpm-lock.yaml in the plugin's folder, keeping those its current lockfile holds. A plugin with dependencies loads only with a lockfile that matches them. Run it after changing the dependencies.",
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
      yield* client["plugin.lock"]({ id }).pipe(
        Effect.catchTags({
          PluginNotFound: () =>
            Effect.fail(
              new CommandFailed({
                reason: "pluginNotFound",
                message: `No plugin in ~/.ivin/plugins has the id ${id}.`,
              }),
            ),
          PluginNotLocked: ({ reason }) =>
            Effect.fail(
              new CommandFailed({
                reason: "notLocked",
                message: `Could not lock the dependencies of plugin ${id}: ${reason}`,
              }),
            ),
        }),
      )
      return { ok: true, text: `Wrote pnpm-lock.yaml for plugin ${id}.`, json: { id } }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
