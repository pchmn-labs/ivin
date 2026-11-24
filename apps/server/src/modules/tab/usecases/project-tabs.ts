import { Effect, Layer } from "effect"
import { ProjectTabs } from "../../project/usecases/project-tabs.ts"
import type { SessionRuns } from "../../session/usecases/session-runs.ts"
import type { WorktreeCleanup } from "../../session/usecases/worktree-cleanup.ts"
import type { CurrentSettings } from "../../setting/usecases/current-settings.ts"
import { afterTabsClosed } from "./after-tabs-closed.ts"
import type { ImageCompression } from "./image-compression.ts"
import { TabStore } from "./tab-store.ts"

export const layerProjectTabs = Layer.effect(ProjectTabs)(
  Effect.gen(function* () {
    const context = yield* Effect.context<
      CurrentSettings | ImageCompression | SessionRuns | TabStore | WorktreeCleanup
    >()
    return {
      closeAll: (projectPath) =>
        Effect.gen(function* () {
          const tabs = yield* TabStore
          const closing = (yield* tabs.listByProject(projectPath)).map((tab) => tab.sessionId)
          yield* tabs.removeByProject(projectPath)
          yield* afterTabsClosed(projectPath, closing)
        }).pipe(Effect.provideContext(context)),
    }
  }),
)
