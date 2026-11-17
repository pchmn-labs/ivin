import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Cause, Effect, Layer, Queue, Stream } from "effect"
import {
  HarnessError,
  HarnessProvider,
  type HarnessRun,
  type StartInput,
} from "../../../shared/harness-provider.ts"

export interface ScriptedSend {
  readonly sessionId: string
  readonly text: string
}

const EVENT_BUFFER = 64

export const layerScripted = (
  turns: readonly (readonly HarnessOutput[])[],
  {
    sent = [],
    starts = [],
    cycle = false,
    reportSession = false,
  }: {
    sent?: ScriptedSend[]
    starts?: StartInput[]
    cycle?: boolean
    reportSession?: boolean
  } = {},
) =>
  Layer.succeed(HarnessProvider)({
    id: "scripted",
    start: (input) =>
      Effect.gen(function* () {
        const { sessionId } = input
        starts.push(input)
        const queue = yield* Effect.acquireRelease(
          Queue.bounded<HarnessOutput, HarnessError | Cause.Done>(EVENT_BUFFER),
          Queue.shutdown,
        )
        if (reportSession)
          yield* Queue.offer(queue, {
            type: "provider_session",
            providerSessionId: input.resume ?? `scripted-${sessionId}`,
          })
        let next = 0
        const run: HarnessRun = {
          events: Stream.fromQueue(queue),
          send: ({ text }) =>
            Effect.suspend(() => {
              sent.push({ sessionId, text })
              const turn = turns[cycle ? next++ % turns.length : next++]
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
