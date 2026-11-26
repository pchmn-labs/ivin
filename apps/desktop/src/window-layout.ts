import { Settings, defaultSettings } from "@ivin/contracts/setting"
import { parseJsonc } from "@ivin/contracts/jsonc"

export type WindowLayout = Settings["window"]["layout"]

const LAYOUTS: ReadonlyArray<unknown> = Settings.fields.window.fields.layout.literals

export const isWindowLayout = (value: unknown): value is WindowLayout => LAYOUTS.includes(value)

// Centred on the top row of the window's layout, 15pt in from the sidebar's left edge.
export const TRAFFIC_LIGHTS = {
  panels: { x: 21, y: 19 },
  plane: { x: 15, y: 13 },
} as const

// The window opens with its traffic lights in place, before the page reports the layout.
export const windowLayoutFrom = (settingsFile: string | null): WindowLayout => {
  const parsed = settingsFile === null ? null : parseJsonc(settingsFile)
  if (parsed === null || !parsed.ok) return defaultSettings.window.layout
  const window = (parsed.value as { window?: { layout?: unknown } } | null)?.window
  const layout = typeof window === "object" && window !== null ? window.layout : undefined
  return isWindowLayout(layout) ? layout : defaultSettings.window.layout
}
