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

export type ScriptedElement = HarnessOutput | ScriptedFailure

const isFailure = (element: ScriptedElement): element is ScriptedFailure =>
  "_tag" in element && element._tag === "ScriptedFailure"

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
  readonly skillsFolder?: string | null
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
    skillsFolder = null,
  }: ScriptedOptions = {},
) =>
  Layer.sync(HarnessProvider)(() => {
    // Per session, so a session whose run ended carries on with the next turn.
    const played = new Map<string, number>()
    return {
      id: "scripted",
      runOptions: Effect.succeed(runOptions),
      program: Effect.succeed(null),
      skillsFolder,
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
          const play = (turn: readonly ScriptedElement[]) => {
            const at = turn.findIndex(
              (element) => !isFailure(element) && element.type === "approval_request",
            )
            paused = at === -1 ? null : turn.slice(at + 1)
            return Effect.forEach(
              at === -1 ? turn : turn.slice(0, at + 1),
              (element) =>
                isFailure(element)
                  ? Queue.fail(queue, new HarnessError({ message: element.message }))
                  : Queue.offer(queue, element),
              { discard: true },
            )
          }
          const run: HarnessRun = {
            events: Stream.fromQueue(queue),
            send: ({ text, images }) =>
              Effect.suspend(() => {
                sent.push({ sessionId, text, images })
                const next = played.get(sessionId) ?? 0
                played.set(sessionId, next + 1)
                const turn = turns[cycle ? next % turns.length : next]
                return turn
                  ? play(turn)
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
                return play(paused)
              }),
            interrupt: Effect.suspend(() => {
              interrupted.push(sessionId)
              return Queue.offerAll(queue, [
                { type: "interruption", raw: null },
                { type: "status", status: "idle", raw: null },
              ]).pipe(Effect.asVoid)
            }),
          }
          return run
        }),
    }
  })
