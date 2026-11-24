import { defaultSettingsFor } from "@ivin/contracts/setting"
import { parseJsonc } from "@ivin/contracts/jsonc"

const updatesSetting = (settingsFile: string | null, key: string): unknown => {
  if (settingsFile === null) return undefined
  const parsed = parseJsonc(settingsFile)
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return undefined
  const updates = (parsed.value as Record<string, unknown>)["updates"]
  if (typeof updates !== "object" || updates === null) return undefined
  return (updates as Record<string, unknown>)[key]
}

// Anything but an explicit false keeps the check on, as the settings page's default does.
export const automaticCheckFrom = (settingsFile: string | null): boolean =>
  updatesSetting(settingsFile, "automaticCheck") !== false

export const betaFrom = (settingsFile: string | null, version: string): boolean => {
  const beta = updatesSetting(settingsFile, "beta")
  return typeof beta === "boolean" ? beta : defaultSettingsFor(version).updates.beta
}
