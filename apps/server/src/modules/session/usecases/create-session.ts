import type { Session } from "@ivin/contracts/session"
import { HarnessProvider } from "@ivin/harness"
import { DateTime, Effect } from "effect"
import { newSessionRunOptions } from "../rules/run-options.ts"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"
import { ProjectStore } from "../../project/usecases/project-store.ts"
import { checkoutStart } from "../../worktree/rules/workspace-folder.ts"
import { Git } from "../../worktree/usecases/git.ts"
import { SessionStore } from "./session-store.ts"

export const defaultTitle = "New session"

export const createSession = (projectPath: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const git = yield* Git
    const { id: harness, runOptions } = yield* HarnessProvider
    const now = yield* DateTime.now
    const start = isWorkspaceFile(projectPath)
      ? checkoutStart((yield* (yield* ProjectStore).folders(projectPath)) ?? [])
      : null
    const workingFolder = start?.cwd ?? projectPath
    const session: Session = {
      id: crypto.randomUUID(),
      projectPath,
      workingFolder,
      inWorktree: false,
      branch: yield* git.currentBranch(workingFolder),
      started: false,
      workingFolderDeleted: false,
      title: defaultTitle,
      harness,
      ...newSessionRunOptions(yield* runOptions, yield* store.lastRunOptions(projectPath)),
      relaunchFailure: null,
      pendingMessages: [],
      unreadMessages: [],
      backgroundTasks: [],
      status: "idle",
      waitingFor: null,
      statusChangedAt: now,
      createdAt: now,
      lastActivityAt: now,
      archivedAt: null,
      lastImageNumber: 0,
    }
    yield* store.insert(session)
    return session
  })
