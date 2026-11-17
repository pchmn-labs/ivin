import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Cause, Effect, Layer, Queue, Stream } from "effect"
import {
  type ApprovalDecision,
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
    responded = [],
    cycle = false,
    reportSession = false,
  }: {
    sent?: ScriptedSend[]
    starts?: StartInput[]
    responded?: ApprovalDecision[]
    cycle?: boolean
    reportSession?: boolean
  } = {},
) =>
  Layer.succeed(HarnessProvider)({
    id: "scripted",
    start: (input) =>
      Effect.gen(function* () {
        starts.push(input)
        const queue = yield* Effect.acquireRelease(
          Queue.bounded<HarnessOutput, HarnessError | Cause.Done>(EVENT_BUFFER),
          Queue.shutdown,
        )
        if (reportSession)
          yield* Queue.offer(queue, {
            type: "provider_session",
            providerSessionId: input.providerSessionId ?? `scripted-${input.sessionId}`,
          })
        let next = 0
        let paused: readonly HarnessOutput[] | null = null
        const offerUntilApproval = (events: readonly HarnessOutput[]) => {
          const at = events.findIndex((event) => event.type === "approval_request")
          paused = at === -1 ? null : events.slice(at + 1)
          return Queue.offerAll(queue, at === -1 ? events : events.slice(0, at + 1)).pipe(
            Effect.asVoid,
          )
        }
        const run: HarnessRun = {
          events: Stream.fromQueue(queue),
          send: ({ text }) =>
            Effect.suspend(() => {
              sent.push({ sessionId: input.sessionId, text })
              const turn = turns[cycle ? next++ % turns.length : next++]
              return turn
                ? offerUntilApproval(turn)
                : Effect.fail(
                    new HarnessError({ message: "The scripted harness has no turn left" }),
                  )
            }),
          respond: (decision) =>
            Effect.suspend(() => {
              if (paused === null)
                return Effect.fail(
                  new HarnessError({ message: "The scripted harness has no paused turn" }),
                )
              responded.push(decision)
              return offerUntilApproval(paused)
            }),
          interrupt: Effect.void,
        }
        return run
      }),
  })
