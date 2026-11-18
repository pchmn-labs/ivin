import type { ProjectTabs } from "@ivin/contracts/tab"
import { Effect } from "effect"
import { TabStore } from "./tab-store.ts"

export const listTabs = (projectPath: string): Effect.Effect<ProjectTabs, never, TabStore> =>
  Effect.gen(function* () {
    const store = yield* TabStore
    return {
      projectPath,
      tabs: yield* store.listByProject(projectPath),
      selectedSessionId: yield* store.selectedOf(projectPath),
    }
  })
