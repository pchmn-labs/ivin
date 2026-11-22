import "../../../core/desktop-bridge.ts"

export const openSettingsFile = (): Promise<string | null> =>
  window.ivin.openSettingsFile().catch((error: unknown) => String(error))
