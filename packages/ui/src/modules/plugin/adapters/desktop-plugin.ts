import "../../../core/desktop-bridge.ts"

// A browser tab or a test has no desktop app, or one that offers only part of the bridge.
const bridge = (): Partial<Window["ivin"]> | null => ("ivin" in window ? window.ivin : null)

export const getStartupNotice = (): Promise<unknown> =>
  bridge()?.getStartupNotice?.() ?? Promise.resolve(null)

export const reportPluginActivity = (id: string, phase: "activating" | "activated"): void =>
  bridge()?.reportPluginActivity?.({ id, phase })

export const reportSettled = (): void => bridge()?.reportSettled?.()
