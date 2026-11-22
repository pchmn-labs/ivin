import {
  defaultSettings,
  type SettingsFileInvalid,
  type SettingsFileProblem,
} from "@ivin/contracts/setting"
import { settingValue } from "./setting-value.ts"

export const SETTINGS_FILE = "~/.ivin/settings.json"

const takes = (path: string) => {
  const value = settingValue(defaultSettings, path)
  if (typeof value === "boolean") return "true or false"
  if (typeof value === "number") return "a number"
  if (typeof value === "string") return "a string"
  return "an object of settings"
}

export const settingsProblemMessage = ({ reason, setting }: SettingsFileProblem): string => {
  if (reason === "notJson") return `${SETTINGS_FILE} is not valid JSON.`
  if (reason === "notAnObject") return `${SETTINGS_FILE} does not hold an object.`
  if (setting === null) return `${SETTINGS_FILE} holds a setting of the wrong type.`
  return `${setting} in ${SETTINGS_FILE} takes ${takes(setting)}.`
}

const isFileInvalid = (error: unknown): error is SettingsFileInvalid =>
  typeof error === "object" &&
  error !== null &&
  "_tag" in error &&
  error._tag === "SettingsFileInvalid"

export const saveFailureMessage = (error: unknown): string =>
  isFileInvalid(error)
    ? `Not saved: ${settingsProblemMessage({ reason: error.reason, setting: null })} Fix it, then try again.`
    : "The setting was not saved."
