import { strongFamily } from "@ivin/state/strong-family"
import { Cause, Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { Session } from "@ivin/contracts/session"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { optimistic } from "@ivin/state/optimistic"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { renameFailure } from "../rules/failure-message.ts"
import { sessionsOf } from "./list-sessions.ts"

export const renameFailureOf = strongFamily((_sessionId: string) =>
  Atom.make<(ActionFailure & { readonly title: string }) | null>(null).pipe(Atom.keepAlive),
)

export const renameSessionAtom = serverRuntime
  .fn<{
    readonly projectPath: string
    readonly sessionId: string
    readonly title: string
  }>()(
    Effect.fnUntraced(function* ({ projectPath, sessionId, title }) {
      const client = yield* ServerClient
      const sessions = sessionsOf(projectPath)
      const before = yield* sessions.get(sessionId)
      yield* Atom.set(renameFailureOf(sessionId), null)
      yield* optimistic<Session>({
        apply: before ? sessions.upsert([{ ...before, title }]) : Effect.void,
        rollback: before ? sessions.upsert([before]) : Effect.void,
        reconcile: (session) => sessions.upsert([session]),
      })(client["session.rename"]({ sessionId, title })).pipe(
        Effect.asVoid,
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.void
            : Atom.set(renameFailureOf(sessionId), {
                ...renameFailure(Cause.squash(cause)),
                title,
              }),
        ),
      )
    }),
  )
  .pipe(Atom.keepAlive)
