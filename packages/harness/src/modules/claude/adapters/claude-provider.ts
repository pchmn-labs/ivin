import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Duration, Effect, Layer, Stream } from "effect"
import { HarnessError, HarnessProvider, type HarnessRun } from "../../../shared/harness-provider.ts"
import { approvalResponseLine } from "../rules/approval-response.ts"
import { claudeArgs } from "../rules/claude-args.ts"
import { decodeClaudeLine } from "../rules/decode-claude-line.ts"
import { describeExit, type ProcessExit } from "../rules/describe-exit.ts"
import { toolActivity } from "../rules/tool-activity.ts"

const EVENT_BUFFER = 64
const STDERR_LIMIT = 8_192
const DEFAULT_KILL_GRACE: Duration.Input = "2 seconds"

const spawnClaude = (
  sessionId: string,
  cwd: string,
  model: string,
  providerSessionId: string | null,
) => {
  const child = spawn("claude", claudeArgs(model, providerSessionId), {
    cwd,
    env: { ...process.env, IVIN_SESSION_ID: sessionId },
    stdio: ["pipe", "pipe", "pipe"],
  })
  let stderr = ""
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    stderr = (stderr + chunk).slice(-STDERR_LIMIT)
  })
  const readline = createInterface({ input: child.stdout, crlfDelay: Infinity })
  // Taken now: an iterator made after the interface closed would never end.
  const iterator = readline[Symbol.asyncIterator]()
  const lines = { [Symbol.asyncIterator]: () => iterator }
  const exited = new Promise<ProcessExit>((resolve) => {
    child.once("error", (error) => {
      // A process that never started leaves stdout open, which would stall the stream.
      readline.close()
      resolve({ error })
    })
    child.once("close", (code, signal) => resolve({ code, signal }))
  })
  const started = new Promise<ProcessExit | undefined>((resolve) => {
    child.once("spawn", () => resolve(undefined))
    child.once("error", (error) => resolve({ error }))
  })
  // A failed write (the process is gone) is reported by `exited`; an unhandled stream error would crash the app.
  child.stdin.on("error", () => {})
  return { child, lines, exited, started, stderr: () => stderr.trim() }
}

export const layerClaudeWith = (killGrace: Duration.Input) =>
  Layer.succeed(HarnessProvider)({
    id: "claude",
    toolActivity,
    start: ({ sessionId, cwd, model, providerSessionId }) =>
      Effect.gen(function* () {
        // spawn reports a missing cwd as ENOENT, the same as a missing binary.
        if (!existsSync(cwd)) {
          return yield* new HarnessError({ message: `The working folder does not exist: ${cwd}` })
        }
        let stoppedByIvin = false
        const { child, lines, exited, started, stderr } = yield* Effect.acquireRelease(
          Effect.sync(() => spawnClaude(sessionId, cwd, model, providerSessionId)),
          ({ child, exited }) =>
            Effect.gen(function* () {
              stoppedByIvin = true
              child.stdin.destroy()
              // Without a pid, kill() would signal this whole process group.
              if (child.pid === undefined) return
              child.kill("SIGTERM")
              // A process that ignores SIGTERM must not hold the finalizer or outlive the app.
              yield* Effect.promise(() => exited).pipe(
                Effect.timeout(killGrace),
                Effect.catch(() => Effect.sync(() => child.kill("SIGKILL"))),
              )
            }),
        )

        const failedToStart = yield* Effect.promise(() => started)
        if (failedToStart) {
          return yield* new HarnessError({
            message: describeExit(failedToStart, ""),
            cause: failedToStart,
          })
        }

        const ended = Stream.fromEffect(
          Effect.promise(() => exited).pipe(
            Effect.flatMap((exit) =>
              Effect.fail(
                new HarnessError({
                  message: describeExit(exit, stderr(), { stoppedByIvin }),
                  cause: exit,
                }),
              ),
            ),
          ),
        )
        const openRequests = new Map<string, unknown>()
        const events = Stream.unwrap(
          Effect.sync(() => {
            let lastStatus: string | undefined
            return Stream.fromAsyncIterable(
              lines,
              (cause) => new HarnessError({ message: "Could not read claude's output", cause }),
            ).pipe(
              Stream.map(decodeClaudeLine),
              Stream.flattenIterable,
              Stream.tap((output: HarnessOutput) =>
                Effect.sync(() => {
                  if (output.type === "approval_request")
                    openRequests.set(output.requestId, output.input)
                }),
              ),
              Stream.filter((output: HarnessOutput) => {
                if (output.type !== "status") return true
                const repeated = output.status === lastStatus
                lastStatus = output.status
                return !repeated
              }),
              Stream.concat(ended),
              Stream.buffer({ capacity: EVENT_BUFFER }),
            )
          }),
        )

        const run: HarnessRun = {
          events,
          send: ({ text }) =>
            Effect.callback<void, HarnessError>((resume) => {
              const line = JSON.stringify({
                type: "user",
                message: { role: "user", content: [{ type: "text", text }] },
              })
              child.stdin.write(`${line}\n`, (error) =>
                resume(
                  error
                    ? Effect.fail(
                        new HarnessError({ message: "Could not write to claude", cause: error }),
                      )
                    : Effect.void,
                ),
              )
            }),
          respond: ({ requestId, allow }) =>
            Effect.suspend(() => {
              if (!openRequests.has(requestId))
                return Effect.fail(
                  new HarnessError({ message: `No approval request is open for ${requestId}` }),
                )
              const line = approvalResponseLine(requestId, allow, openRequests.get(requestId))
              return Effect.callback<void, HarnessError>((resume) => {
                child.stdin.write(`${line}\n`, (error) =>
                  resume(
                    error
                      ? Effect.fail(
                          new HarnessError({ message: "Could not write to claude", cause: error }),
                        )
                      : Effect.sync(() => void openRequests.delete(requestId)),
                  ),
                )
              })
            }),
          interrupt: Effect.sync(() => {
            const request = {
              type: "control_request",
              request_id: randomUUID(),
              request: { subtype: "interrupt" },
            }
            child.stdin.write(`${JSON.stringify(request)}\n`)
          }),
        }
        return run
      }),
  })

export const layerClaude = layerClaudeWith(DEFAULT_KILL_GRACE)
