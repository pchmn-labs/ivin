import { Effect } from "effect"
import { stopAgentOnTabClose } from "../../session/usecases/stop-agent-on-tab-close.ts"
import { WorktreeCleanup } from "../../session/usecases/worktree-cleanup.ts"
import { ImageCompression } from "./image-compression.ts"

export const afterTabsClosed = (projectPath: string, sessionIds: readonly string[]) =>
  Effect.gen(function* () {
    yield* stopAgentOnTabClose(sessionIds)
    yield* (yield* WorktreeCleanup).afterTabsClosed(projectPath, sessionIds)
    yield* (yield* ImageCompression).afterTabsClosed(sessionIds)
  })
