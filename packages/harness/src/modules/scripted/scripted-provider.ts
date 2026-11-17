import type { HarnessEvent } from "@ivin/contracts/transcript"
import { Cause, Effect, Layer, Queue, Stream } from "effect"
import { HarnessError, HarnessProvider, type HarnessRun } from "../../shared/harness-provider.ts"

export interface ScriptedSend {
  readonly sessionId: string
  readonly text: string
}

const EVENT_BUFFER = 64

export const layerScripted = (
  turns: readonly (readonly HarnessEvent[])[],
  sent: ScriptedSend[] = [],
) =>
  Layer.succeed(HarnessProvider)({
    id: "scripted",
    start: ({ sessionId }) =>
      Effect.gen(function* () {
        const queue = yield* Effect.acquireRelease(
          Queue.bounded<HarnessEvent, HarnessError | Cause.Done>(EVENT_BUFFER),
          Queue.shutdown,
        )
        let next = 0
        const run: HarnessRun = {
          events: Stream.fromQueue(queue),
          send: ({ text }) =>
            Effect.suspend(() => {
              sent.push({ sessionId, text })
              const turn = turns[next++]
              return turn
                ? Queue.offerAll(queue, turn).pipe(Effect.asVoid)
                : Effect.fail(
                    new HarnessError({ message: "The scripted harness has no turn left" }),
                  )
            }),
          respond: () => Effect.void,
          interrupt: Effect.void,
        }
        return run
      }),
  })
