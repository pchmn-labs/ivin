import { settingSections, type PluginSetting } from "@ivin/contracts/setting"

export interface PageSetting {
  readonly path: string
  readonly label: string
  readonly description: string
  readonly choices?: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly count?: { readonly min: number; readonly unit: string }
  readonly plugin?: PluginSetting
}

export interface PageSection {
  readonly key: string
  readonly title: string
  readonly description: string
  readonly settings: ReadonlyArray<PageSetting>
  readonly pluginId?: string
}

const images: PageSection = {
  key: "images",
  title: "Images",
  description: "The images you sent to agents. ivin keeps them until you delete them here.",
  settings: [],
}

const projectPlugins: PageSection = {
  key: "plugins",
  title: "Plugins",
  description: "The plugins your trusted projects ship, and which of their changes run.",
  settings: [],
}

const commandLine: PageSection = {
  key: "commandLine",
  title: "Command line",
  description: "Run ivin from your own terminal.",
  settings: [],
}

const pluginSetting = (setting: PluginSetting): PageSetting => ({
  path: `${setting.pluginId}.${setting.key}`,
  label: setting.title,
  description: setting.description,
  ...(setting.values !== undefined && {
    choices: setting.values.map((value) => ({ value, label: value })),
  }),
  plugin: setting,
})

// A plugin with a `settings.section` contribution gets a section too, with none generated.
export const settingsPageSections = (
  pluginSettings: ReadonlyArray<PluginSetting>,
  pluginsWithOwnSection: ReadonlyArray<string>,
  // The plugins' names by id; a plugin left out is named by its id.
  pluginNames: ReadonlyMap<string, string> = new Map(),
): ReadonlyArray<PageSection> => {
  const plugins = new Map<string, { name: string; settings: PluginSetting[] }>()
  for (const setting of pluginSettings) {
    const plugin = plugins.get(setting.pluginId) ?? { name: setting.pluginName, settings: [] }
    plugin.settings.push(setting)
    plugins.set(setting.pluginId, plugin)
  }
  for (const id of pluginsWithOwnSection) {
    if (!plugins.has(id)) plugins.set(id, { name: pluginNames.get(id) ?? id, settings: [] })
  }
  return [
    ...settingSections.filter((section) => section.key !== "updates"),
    images,
    ...settingSections.filter((section) => section.key === "updates"),
    projectPlugins,
    ...[...plugins].map(([pluginId, { name, settings }]) => ({
      key: `plugin:${pluginId}`,
      title: name,
      description: `Settings of the ${name} plugin.`,
      settings: settings.map(pluginSetting),
      pluginId,
    })),
    commandLine,
  ]
}
