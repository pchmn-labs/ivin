import { ProjectNotOpen } from "@ivin/contracts/project"
import { Effect } from "effect"
import { selectionAfterRemoval } from "../../../shared/rules/selection-after-removal.ts"
import { stopAgentOnTabClose } from "../../session/usecases/stop-agent-on-tab-close.ts"
import { TabStore } from "../../tab/usecases/tab-store.ts"
import { ImageCompression } from "../../transcript/usecases/image-compression.ts"
import { WorktreeCleanup } from "../../worktree/usecases/worktree-cleanup.ts"
import { ProjectStore } from "./project-store.ts"

export const closeProject = (path: string) =>
  Effect.gen(function* () {
    const store = yield* ProjectStore
    const tabs = yield* TabStore
    const open = yield* store.listOpen
    const order = open.projects.map((project) => project.path)
    if (!order.includes(path)) return yield* new ProjectNotOpen({ path })
    const closing = yield* tabs.listByProject(path)
    yield* tabs.removeByProject(path)
    const closingIds = closing.map((tab) => tab.sessionId)
    yield* stopAgentOnTabClose(closingIds)
    yield* (yield* WorktreeCleanup).afterTabsClosed(path, closingIds)
    yield* (yield* ImageCompression).afterTabsClosed(closingIds)
    yield* store.removeOpen(path)
    if (open.selectedPath === path) yield* store.select(selectionAfterRemoval(order, path))
    return yield* store.listOpen
  })
