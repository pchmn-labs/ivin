import type { HarnessRunOptions } from "@ivin/contracts/session"
import type { HarnessOutput, ImageData } from "@ivin/contracts/transcript"
import type { Cause } from "effect"
import { Deferred, type Duration, Effect, Layer, Queue, Stream } from "effect"
import {
  HarnessError,
  HarnessProvider,
  type HarnessRun,
  type RequestAnswer,
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

// Plays `elements` once `gate` completes, with no message sent, as an agent does when a background task finishes.
export interface ScriptedLater {
  readonly _tag: "ScriptedLater"
  readonly gate: Deferred.Deferred<void>
  readonly elements: readonly HarnessOutput[]
}

export const scriptedLater = (
  gate: Deferred.Deferred<void>,
  elements: readonly HarnessOutput[],
): ScriptedLater => ({ _tag: "ScriptedLater", gate, elements })

export type ScriptedElement = HarnessOutput | ScriptedFailure | ScriptedRead | ScriptedLater

const isFailure = (element: ScriptedElement): element is ScriptedFailure =>
  "_tag" in element && element._tag === "ScriptedFailure"

const isRead = (element: ScriptedElement): element is ScriptedRead =>
  "_tag" in element && element._tag === "ScriptedRead"

const isLater = (element: ScriptedElement): element is ScriptedLater =>
  "_tag" in element && element._tag === "ScriptedLater"

const isPause = (element: ScriptedElement) =>
  !isFailure(element) &&
  !isRead(element) &&
  !isLater(element) &&
  (element.type === "approval_request" || element.type === "question_request")

const EVENT_BUFFER = 64

export interface ScriptedOptions {
  readonly sent?: ScriptedSend[]
  readonly interrupted?: string[]
  // Receives `<sessionId>/<taskId>` for each task stopped.
  readonly stoppedTasks?: string[]
  // Receives the sessionId when a run's scope closes, which is when its agent process would stop.
  readonly closed?: string[]
  readonly cycle?: boolean
  readonly closeDelay?: Duration.Input
  readonly startFailure?: string
  // `start` completes `reached` once its process exists, then waits for `release`.
  readonly startGate?: {
    readonly reached: Deferred.Deferred<void>
    readonly release: Deferred.Deferred<void>
  }
  // The interrupt is recorded but the agent keeps its turn.
  readonly ignoreInterrupt?: boolean
  readonly starts?: StartInput[]
  readonly responded?: RequestAnswer[]
  // Announces a provider session id on start, as an adapter does when it learns one.
  readonly reportSession?: boolean
  readonly runOptions?: HarnessRunOptions
  readonly completeText?: (prompt: string) => Effect.Effect<string, HarnessError>
  // What reading a task's output file gives, by path.
  readonly taskOutputs?: Readonly<Record<string, string>>
}

const offered = (value: string, name: string, description: string | null = null) => ({
  value,
  name,
  description,
})

export const scriptedRunOptions: HarnessRunOptions = {
  model: {
    values: [
      { ...offered("scripted", "Scripted"), efforts: ["low", "high"], older: false },
      { ...offered("scripted-large", "Scripted large"), efforts: ["low", "high"], older: false },
    ],
    default: "scripted",
  },
  effort: { values: [offered("low", "Low"), offered("high", "High")], default: "low" },
  permissionMode: {
    values: [
      offered("ask", "Ask", "Asks before edits and commands"),
      offered("auto", "Auto", "Blocks risky actions, runs the rest"),
    ],
    default: "ask",
  },
}

export const layerScripted = (
  turns: readonly (readonly ScriptedElement[])[],
  {
    sent = [],
    interrupted = [],
    stoppedTasks = [],
    closed = [],
    starts = [],
    responded = [],
    cycle = false,
    closeDelay = 0,
    startFailure,
    startGate,
    ignoreInterrupt = false,
    reportSession = false,
    runOptions = scriptedRunOptions,
    completeText,
    taskOutputs = {},
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
      completeText: completeText ?? null,
      readTaskOutput: (path) => Effect.succeed(taskOutputs[path] ?? ""),
      // Scripts replay recorded Claude output.
      toolActivity,
      toolKind,
      start: (input) =>
        Effect.gen(function* () {
          const { sessionId } = input
          const scope = yield* Effect.scope
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
          if (startGate) {
            yield* Deferred.succeed(startGate.reached, undefined)
            yield* Deferred.await(startGate.release)
          }
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
            if (isLater(element)) {
              return Deferred.await(element.gate).pipe(
                Effect.andThen(Effect.forEach(element.elements, offer, { discard: true })),
                Effect.forkIn(scope),
                Effect.asVoid,
              )
            }
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
            respond: (answer) =>
              Effect.suspend(() => {
                if (paused === null)
                  return Effect.fail(
                    new HarnessError({ message: "The scripted harness has no paused turn" }),
                  )
                responded.push(answer)
                return play(paused)
              }),
            stopTask: (taskId) =>
              Effect.sync(() => void stoppedTasks.push(`${sessionId}/${taskId}`)),
            interrupt: Effect.suspend(() => {
              interrupted.push(sessionId)
              if (ignoreInterrupt) return Effect.void
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
