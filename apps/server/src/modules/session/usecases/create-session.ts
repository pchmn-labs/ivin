import type { Session } from "@ivin/contracts/session"
import { DateTime, Effect } from "effect"
import { SessionStore } from "./session-store.ts"

export const defaultTitle = "New session"

export const createSession = (projectPath: string) =>
  Effect.gen(function* () {
    const store = yield* SessionStore
    const now = yield* DateTime.now
    const session: Session = {
      id: crypto.randomUUID(),
      projectPath,
      title: defaultTitle,
      createdAt: now,
      lastActivityAt: now,
    }
    yield* store.insert(session)
    return session
  })
