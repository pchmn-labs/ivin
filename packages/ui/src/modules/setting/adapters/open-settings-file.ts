import "../../../core/desktop-bridge.ts"

export const openSettingsFile = (): Promise<boolean> =>
  window.ivin.openSettingsFile().catch(() => false)
