import type { HarnessRunOptions } from "@ivin/contracts/session"
import type { HarnessOutput, ImageData } from "@ivin/contracts/transcript"
import { Cause, type Duration, Effect, Layer, Queue, Stream } from "effect"
import {
  type ApprovalDecision,
  HarnessError,
  HarnessProvider,
  type HarnessRun,
  type StartInput,
} from "../../../shared/harness-provider.ts"
import { toolActivity } from "../../claude/rules/tool-activity.ts"
import { toolKind } from "../../claude/rules/tool-kind.ts"

export interface ScriptedSend {
  readonly sessionId: string
  readonly id: string
  readonly text: string
  readonly images: readonly ImageData[]
}

export interface ScriptedFailure {
  readonly _tag: "ScriptedFailure"
  readonly message: string
}

export const scriptedFailure = (message: string): ScriptedFailure => ({
  _tag: "ScriptedFailure",
  message,
})

// Where the turn reads the messages sent to it while it runs, as Claude Code does after a tool result.
export interface ScriptedRead {
  readonly _tag: "ScriptedRead"
}

export const scriptedRead: ScriptedRead = { _tag: "ScriptedRead" }

export type ScriptedElement = HarnessOutput | ScriptedFailure | ScriptedRead

const isFailure = (element: ScriptedElement): element is ScriptedFailure =>
  "_tag" in element && element._tag === "ScriptedFailure"

const isRead = (element: ScriptedElement): element is ScriptedRead =>
  "_tag" in element && element._tag === "ScriptedRead"

const isPause = (element: ScriptedElement) =>
  !isFailure(element) && !isRead(element) && element.type === "approval_request"

const EVENT_BUFFER = 64

export interface ScriptedOptions {
  readonly sent?: ScriptedSend[]
  readonly interrupted?: string[]
  // Receives the sessionId when a run's scope closes, which is when its agent process would stop.
  readonly closed?: string[]
  readonly cycle?: boolean
  readonly closeDelay?: Duration.Input
  readonly startFailure?: string
  readonly starts?: StartInput[]
  readonly responded?: ApprovalDecision[]
  // Announces a provider session id on start, as an adapter does when it learns one.
  readonly reportSession?: boolean
  readonly runOptions?: HarnessRunOptions
}

const offered = (value: string, name: string) => ({ value, name, description: null })

export const scriptedRunOptions: HarnessRunOptions = {
  model: {
    values: [
      { ...offered("scripted", "Scripted"), efforts: ["low", "high"], older: false },
      { ...offered("scripted-large", "Scripted large"), efforts: ["low", "high"], older: false },
    ],
    default: "scripted",
  },
  effort: { values: [offered("low", "Low"), offered("high", "High")], default: "low" },
  permissionMode: { values: [offered("ask", "Ask"), offered("auto", "Auto")], default: "ask" },
}

export const layerScripted = (
  turns: readonly (readonly ScriptedElement[])[],
  {
    sent = [],
    interrupted = [],
    closed = [],
    starts = [],
    responded = [],
    cycle = false,
    closeDelay = 0,
    startFailure,
    reportSession = false,
    runOptions = scriptedRunOptions,
  }: ScriptedOptions = {},
) =>
  Layer.sync(HarnessProvider)(() => {
    // Per session, so a session whose run ended carries on with the next turn.
    const played = new Map<string, number>()
    return {
      id: "scripted",
      runOptions: Effect.succeed(runOptions),
      program: Effect.succeed(null),
      skillsFolder: null,
      // Scripts replay recorded Claude output.
      toolActivity,
      toolKind,
      start: (input) =>
        Effect.gen(function* () {
          const { sessionId } = input
          starts.push(input)
          if (startFailure !== undefined) {
            return yield* new HarnessError({ message: startFailure })
          }
          const queue = yield* Effect.acquireRelease(
            Queue.bounded<HarnessOutput, HarnessError | Cause.Done>(EVENT_BUFFER),
            (queue) =>
              Effect.sleep(closeDelay).pipe(
                Effect.andThen(Effect.sync(() => closed.push(sessionId))),
                Effect.andThen(Queue.shutdown(queue)),
              ),
          )
          if (reportSession)
            yield* Queue.offer(queue, {
              type: "provider_session",
              providerSessionId: input.providerSessionId ?? `scripted-${sessionId}`,
            })
          let paused: readonly ScriptedElement[] | null = null
          // Between a scripted running status and its idle one; a turn with no status never opens.
          let open = false
          const waiting: string[] = []
          const readWaiting = Effect.suspend(() =>
            Queue.offerAll(
              queue,
              waiting.splice(0).map((messageId) => ({ type: "message_read" as const, messageId })),
            ),
          )
          const nextTurn: Effect.Effect<void, HarnessError> = Effect.suspend(() => {
            const next = played.get(sessionId) ?? 0
            played.set(sessionId, next + 1)
            const turn = turns[cycle ? next % turns.length : next]
            return turn
              ? play(turn)
              : Effect.fail(new HarnessError({ message: "The scripted harness has no turn left" }))
          })
          // Claude Code starts the messages still queued at a turn's end as the next turn.
          const turnEnded = Effect.suspend(() => {
            open = false
            return waiting.length === 0 ? Effect.void : readWaiting.pipe(Effect.andThen(nextTurn))
          })
          const offer = (element: ScriptedElement): Effect.Effect<void, HarnessError> => {
            if (isFailure(element))
              return Queue.fail(queue, new HarnessError({ message: element.message }))
            if (isRead(element)) return readWaiting.pipe(Effect.asVoid)
            return Queue.offer(queue, element).pipe(
              Effect.andThen(() => {
                if (element.type !== "status") return Effect.void
                if (element.status === "running") open = true
                return element.status === "idle" ? turnEnded : Effect.void
              }),
            )
          }
          const play = (turn: readonly ScriptedElement[]): Effect.Effect<void, HarnessError> => {
            const at = turn.findIndex(isPause)
            paused = at === -1 ? null : turn.slice(at + 1)
            return Effect.forEach(at === -1 ? turn : turn.slice(0, at + 1), offer, {
              discard: true,
            })
          }
          const run: HarnessRun = {
            events: Stream.fromQueue(queue),
            send: ({ id, text, images }) =>
              Effect.suspend(() => {
                sent.push({ sessionId, id, text, images })
                if (!open) return nextTurn
                waiting.push(id)
                return Effect.void
              }),
            respond: (decision) =>
              Effect.suspend(() => {
                if (paused === null)
                  return Effect.fail(
                    new HarnessError({ message: "The scripted harness has no paused turn" }),
                  )
                responded.push(decision)
                return play(paused)
              }),
            interrupt: Effect.suspend(() => {
              interrupted.push(sessionId)
              paused = null
              return Queue.offerAll(queue, [
                { type: "interruption", raw: null },
                { type: "status", status: "idle", raw: null },
              ]).pipe(
                Effect.andThen(turnEnded),
                // A real harness reports a failed next turn on its events, not to the interrupt.
                Effect.catch((error) => Queue.fail(queue, error)),
                Effect.asVoid,
              )
            }),
          }
          return run
        }),
    }
  })
