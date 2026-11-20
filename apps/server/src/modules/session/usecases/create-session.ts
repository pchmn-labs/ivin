import type { Session } from "@ivin/contracts/session"
import { HarnessProvider } from "@ivin/harness"
import { DateTime, Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { SessionStore } from "./session-store.ts"

export const defaultTitle = "New session"

export const createSession = (projectPath: string, model: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const git = yield* Git
    const { id: harness } = yield* HarnessProvider
    const now = yield* DateTime.now
    const session: Session = {
      id: crypto.randomUUID(),
      projectPath,
      workingFolder: projectPath,
      inWorktree: false,
      branch: yield* git.currentBranch(projectPath),
      started: false,
      workingFolderDeleted: false,
      title: defaultTitle,
      harness,
      model,
      status: "idle",
      statusChangedAt: now,
      createdAt: now,
      lastActivityAt: now,
      archivedAt: null,
      lastImageNumber: 0,
    }
    yield* store.insert(session)
    return session
  })
