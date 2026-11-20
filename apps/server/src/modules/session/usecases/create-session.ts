import type { Session } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { Git } from "../../worktree/usecases/git.ts"
import { SessionStore } from "./session-store.ts"

export const defaultTitle = "New session"

export const createSession = (projectPath: string, model: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const git = yield* Git
    const now = yield* DateTime.now
    const session: Session = {
      id: crypto.randomUUID(),
      projectPath,
      workingFolder: projectPath,
      inWorktree: false,
      branch: yield* git.currentBranch(projectPath),
      started: false,
      title: defaultTitle,
      model,
      status: "idle",
      statusChangedAt: now,
      createdAt: now,
      lastActivityAt: now,
    }
    yield* store.insert(session)
    return session
  })
