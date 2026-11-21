import type {
  SettingPathUnknown,
  SettingsFileInvalid,
  SettingValueInvalid,
} from "@ivin/contracts/setting"
import { CommandFailed } from "./command.ts"

const expectedText = { boolean: "true or false", number: "a number", string: "a string" }

export const settingFailed = (
  error: SettingPathUnknown | SettingValueInvalid | SettingsFileInvalid,
  value?: unknown,
) => {
  switch (error._tag) {
    case "SettingPathUnknown":
      return new CommandFailed({
        reason: "unknownSetting",
        message: `No setting is named "${error.path}". The settings are: ${error.knownPaths.join(", ")}.`,
      })
    case "SettingValueInvalid":
      return new CommandFailed({
        reason: "invalidValue",
        message: `${error.path} takes ${expectedText[error.expected]}, not ${JSON.stringify(value)}.`,
      })
    case "SettingsFileInvalid": {
      const { parseError } = error
      const problem =
        error.reason === "notAnObject"
          ? "does not hold an object"
          : parseError === null
            ? "is not valid JSON"
            : `is not valid JSON: ${parseError.code} at line ${parseError.line}, column ${parseError.column}`
      return new CommandFailed({
        reason: "invalidFile",
        message: `${error.path} ${problem}. Fix it, then run the command again.`,
      })
    }
  }
}
