import { SessionNotFound } from "@ivin/contracts/session"
import { Effect } from "effect"
import { SessionStore } from "../../session/usecases/session-store.ts"
import { stopAgentOnTabClose } from "../../session/usecases/stop-agent-on-tab-close.ts"
import { ImageCompression } from "../../transcript/usecases/image-compression.ts"
import { WorktreeCleanup } from "../../worktree/usecases/worktree-cleanup.ts"
import { listTabs } from "./list-tabs.ts"
import { removeTab } from "./remove-tab.ts"

export const closeTab = (sessionId: string) =>
  Effect.gen(function* () {
    const tab = yield* removeTab(sessionId)
    if (!tab) {
      const session = yield* (yield* SessionStore).findById(sessionId)
      if (!session) return yield* new SessionNotFound({ sessionId })
      return yield* listTabs(session.projectPath)
    }
    yield* stopAgentOnTabClose([sessionId])
    yield* (yield* WorktreeCleanup).afterTabsClosed(tab.projectPath, [sessionId])
    yield* (yield* ImageCompression).afterTabsClosed([sessionId])
    return yield* listTabs(tab.projectPath)
  })
