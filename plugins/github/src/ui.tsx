import { lazy } from "react"
import { defineUi } from "@ivin/plugin-api/ui"

const SettingsSection = lazy(() =>
  import("./ui/settings-section.tsx").then((m) => ({ default: m.SettingsSection })),
)

export const activate = defineUi((ctx) => {
  ctx.slots.add("settings.section", SettingsSection, { name: "settings" })
})
