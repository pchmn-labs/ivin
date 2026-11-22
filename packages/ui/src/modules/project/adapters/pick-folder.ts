import "../../../core/desktop-bridge.ts"

export const pickFolder = (): Promise<string | null> => window.ivin.pickFolder()
