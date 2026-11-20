import type { SessionChange } from "@ivin/contracts/session"
import { Effect, Stream } from "effect"
import { SessionFeed } from "./session-feed.ts"
import { listSessions } from "./list-sessions.ts"

export const watchSessions = (projectPath: string) =>
  Stream.unwrap(
    Effect.gen(function* () {
      const feed = yield* SessionFeed
      const changes = yield* feed.watch(projectPath)
      const current = yield* listSessions(projectPath)
      return Stream.fromIterable(
        current.map((session): SessionChange => ({ _tag: "changed", session })),
      ).pipe(Stream.concat(changes))
    }),
  )
