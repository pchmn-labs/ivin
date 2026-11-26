import "../../../core/desktop-bridge.ts"
import type { Settings } from "@ivin/contracts/setting"

type WindowLayout = Settings["window"]["layout"]

const KEY = "ivin.window.layout"

export const readStoredWindowLayout = (): WindowLayout | null => {
  const stored = localStorage.getItem(KEY)
  return stored === "panels" || stored === "plane" ? stored : null
}

export const storeWindowLayout = (layout: WindowLayout): void => localStorage.setItem(KEY, layout)

// A browser tab or a test has no desktop app, or one that offers only part of the bridge.
export const placeWindowButtons = (layout: WindowLayout): void => {
  const bridge: Partial<Window["ivin"]> | null = "ivin" in window ? window.ivin : null
  bridge?.setWindowLayout?.(layout)
}
