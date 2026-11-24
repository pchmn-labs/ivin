import type { Session } from "@ivin/plugin-api/ui"
import type { FolderTree } from "./folder-tree.ts"

export interface SessionView {
  readonly tree: FolderTree
  readonly filter: string
}

export const NOTHING_OPEN: SessionView = {
  tree: { open: new Set(), folders: new Map() },
  filter: "",
}

// Lives as long as the plugin is active.
export interface PluginState {
  // What each session had open, and its filter.
  readonly remembered: Map<string, SessionView>
  showIgnored: boolean
  readonly collapseAll: Set<() => void>
  readonly toggleIgnored: Set<() => void>
  readonly openGoToFile: Set<() => void>
}

// A session moved to another working folder starts a new tree.
export const treeKey = (session: Session) => `${session.id}\n${session.workingFolder}`
