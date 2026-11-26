import { Settings, type SettingsFileProblem, type UserSettings } from "@ivin/contracts/setting"
import { parseJsonc } from "@ivin/contracts/jsonc"

class Invalid {
  constructor(readonly problem: SettingsFileProblem) {}
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const sectionOf = (file: Record<string, unknown>, key: string) => {
  const value = file[key]
  if (value === undefined) return {}
  if (!isObject(value)) throw new Invalid({ reason: "invalidSetting", setting: key })
  return value
}

const booleanOf = (
  file: Record<string, unknown>,
  section: string,
  key: string,
  fallback: boolean,
) => {
  const value = sectionOf(file, section)[key]
  if (value === undefined) return fallback
  if (typeof value !== "boolean") {
    throw new Invalid({ reason: "invalidSetting", setting: `${section}.${key}` })
  }
  return value
}

const minutesOf = (
  file: Record<string, unknown>,
  section: string,
  key: string,
  fallback: number,
) => {
  const value = sectionOf(file, section)[key]
  if (value === undefined) return fallback
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Invalid({ reason: "invalidSetting", setting: `${section}.${key}` })
  }
  return value
}

const choiceOf = <Value extends string>(
  file: Record<string, unknown>,
  section: string,
  key: string,
  values: ReadonlyArray<Value>,
  fallback: Value,
): Value => {
  const value = sectionOf(file, section)[key]
  if (value === undefined) return fallback
  if (!values.includes(value as Value)) {
    throw new Invalid({ reason: "invalidSetting", setting: `${section}.${key}` })
  }
  return value as Value
}

const read = (text: string | null, defaults: Settings): Settings => {
  if (text === null || text.trim() === "") return defaults
  const parsed = parseJsonc(text)
  if (!parsed.ok) throw new Invalid({ reason: "notJson", setting: null })
  const file = parsed.value
  if (!isObject(file)) throw new Invalid({ reason: "notAnObject", setting: null })
  return {
    tabs: {
      stopAgentOnClose: booleanOf(file, "tabs", "stopAgentOnClose", defaults.tabs.stopAgentOnClose),
      newTabPosition: choiceOf(
        file,
        "tabs",
        "newTabPosition",
        Settings.fields.tabs.fields.newTabPosition.literals,
        defaults.tabs.newTabPosition,
      ),
    },
    worktrees: {
      removeOnTabClose: booleanOf(
        file,
        "worktrees",
        "removeOnTabClose",
        defaults.worktrees.removeOnTabClose,
      ),
    },
    files: {
      folderIcons: booleanOf(file, "files", "folderIcons", defaults.files.folderIcons),
    },
    window: {
      layout: choiceOf(
        file,
        "window",
        "layout",
        Settings.fields.window.fields.layout.literals,
        defaults.window.layout,
      ),
    },
    sidebar: {
      layout: choiceOf(
        file,
        "sidebar",
        "layout",
        Settings.fields.sidebar.fields.layout.literals,
        defaults.sidebar.layout,
      ),
    },
    agents: {
      stopWhenIdleMinutes: minutesOf(
        file,
        "agents",
        "stopWhenIdleMinutes",
        defaults.agents.stopWhenIdleMinutes,
      ),
    },
    updates: {
      automaticCheck: booleanOf(file, "updates", "automaticCheck", defaults.updates.automaticCheck),
      beta: booleanOf(file, "updates", "beta", defaults.updates.beta),
    },
  }
}

export const readSettingsFile = (
  previous: UserSettings,
  text: string | null,
  defaults: Settings,
): UserSettings => {
  try {
    return { settings: read(text, defaults), problem: null }
  } catch (error) {
    if (!(error instanceof Invalid)) throw error
    return { settings: previous.settings, problem: error.problem }
  }
}
