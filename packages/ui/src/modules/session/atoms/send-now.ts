import { strongFamily } from "@ivin/state/strong-family"
import { Cause, Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { sendNowFailure } from "../rules/failure-message.ts"
import { sessionsOf } from "./list-sessions.ts"

export const sendNowFailureOf = strongFamily((_sessionId: string) =>
  Atom.make<ActionFailure | null>(null).pipe(Atom.keepAlive),
)

export const sendNowAtom = serverRuntime
  .fn<{
    readonly projectPath: string
    readonly sessionId: string
  }>()(
    Effect.fnUntraced(function* ({ projectPath, sessionId }) {
      const client = yield* ServerClient
      yield* Atom.set(sendNowFailureOf(sessionId), null)
      yield* client["session.sendNow"]({ sessionId }).pipe(
        Effect.flatMap((session) => sessionsOf(projectPath).upsert([session])),
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.void
            : Atom.set(sendNowFailureOf(sessionId), sendNowFailure(Cause.squash(cause))),
        ),
      )
    }),
  )
  .pipe(Atom.keepAlive)
