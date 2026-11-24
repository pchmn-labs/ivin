import { parseJsonc } from "@ivin/contracts/jsonc"

// Anything but an explicit false keeps the check on, as the settings page's default does.
export const automaticCheckFrom = (settingsFile: string | null): boolean => {
  if (settingsFile === null) return true
  const parsed = parseJsonc(settingsFile)
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) return true
  const updates = (parsed.value as Record<string, unknown>)["updates"]
  if (typeof updates !== "object" || updates === null) return true
  return (updates as Record<string, unknown>)["automaticCheck"] !== false
}
