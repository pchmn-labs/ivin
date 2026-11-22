import { settingSections } from "@ivin/contracts/setting"

export const settingsPageSections = [
  ...settingSections,
  {
    key: "commandLine",
    title: "Command line",
    description: "Run ivin from your own terminal.",
    settings: [],
  },
] as const

export type SettingsPageSectionKey = (typeof settingsPageSections)[number]["key"]
