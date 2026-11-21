import { Effect } from "effect"
import { type Command } from "./command.ts"
import { Server } from "./connection.ts"
import { settingFailed } from "./setting-failure.ts"

const isSection = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const linesOf = (value: unknown, path: string): string[] =>
  isSection(value)
    ? Object.entries(value).flatMap(([key, inner]) =>
        linesOf(inner, path === "" ? key : `${path}.${key}`),
      )
    : [`${path} = ${JSON.stringify(value)}`]

export const settingsGet: Command = {
  name: "settings get",
  summary: "Print ivin's settings, or one of them",
  usage: "ivin settings get [path]",
  description:
    "Prints the settings ivin uses, one `path = value` line each, or the value at a dotted path such as tabs.stopAgentOnClose. A setting left out of settings.json has its default value.",
  options: {},
  maxArguments: 1,
  run: ({ positionals }) =>
    Effect.gen(function* () {
      const { client } = yield* Server
      const path = positionals[0] ?? null
      const value = yield* client["setting.get"]({ path }).pipe(
        Effect.catchTag("SettingPathUnknown", (error) => Effect.fail(settingFailed(error))),
      )
      return {
        ok: true,
        text: isSection(value) ? linesOf(value, path ?? "").join("\n") : JSON.stringify(value),
        json: { path, value },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
