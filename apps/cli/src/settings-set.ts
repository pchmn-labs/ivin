import { Effect, type Schema } from "effect"
import { type Command, type Input, UsageError } from "./command.ts"
import { Server } from "./connection.ts"
import { settingFailed } from "./settings-failure.ts"

const argumentsOf = ({ positionals }: Input) => {
  const [path, text] = positionals
  if (path === undefined || text === undefined) {
    return new UsageError({ message: "ivin settings set needs a setting and a value." })
  }
  let value: Schema.Json
  try {
    value = JSON.parse(text) as Schema.Json
  } catch {
    value = text
  }
  return { path, value }
}

export const settingsSet: Command = {
  name: "settings set",
  summary: "Change one of ivin's settings",
  usage: "ivin settings set <path> <value>",
  description:
    "Writes the value at a dotted path such as tabs.stopAgentOnClose into ~/.ivin/settings.json, leaving the rest of the file, its comments included, as it is. The value is read as JSON, else as a string. The running app applies it at once.",
  options: {},
  maxArguments: 2,
  check: (input) => {
    const parsed = argumentsOf(input)
    return parsed instanceof UsageError ? parsed : null
  },
  run: (input) =>
    Effect.gen(function* () {
      const parsed = argumentsOf(input)
      if (parsed instanceof UsageError) return yield* parsed
      const { path, value } = parsed
      const { client } = yield* Server
      yield* client["setting.set"]({ path, value }).pipe(
        Effect.catchTag(
          [
            "SettingPathUnknown",
            "SettingValueInvalid",
            "SettingsFileInvalid",
            "SettingsFileUnavailable",
          ],
          (error) => Effect.fail(settingFailed(error, value)),
        ),
      )
      return {
        ok: true,
        text: `${path} is now ${JSON.stringify(value)}.`,
        json: { path, value },
      }
    }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
}
