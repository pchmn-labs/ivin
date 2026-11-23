import type { SessionChange } from "@ivin/contracts/session"
import { Effect, Stream } from "effect"
import { SessionStore } from "./session-store.ts"
import { SessionFeed } from "./session-feed.ts"
import { listSessions } from "./list-sessions.ts"

export const watchSessions = (projectPath: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const current = listSessions(projectPath).pipe(
        Effect.map((sessions) =>
          sessions.map((session): SessionChange => ({ _tag: "changed", session })),
        ),
      )
      const context = yield* Effect.context<SessionStore>()
      const changes = yield* (yield* SessionFeed).watch(
        projectPath,
        Effect.provide(current, context),
      )
      return Stream.fromIterable(yield* current).pipe(Stream.concat(changes))
    }),
  )
