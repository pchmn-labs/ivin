import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { open } from "node:fs/promises"
import { homedir } from "node:os"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import type { HarnessRunOptions, RunOptions } from "@ivin/contracts/session"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import type { Duration } from "effect"
import { Effect, Layer, Stream } from "effect"
import { HarnessError, HarnessProvider, type HarnessRun } from "../../../shared/harness-provider.ts"
import { approvalResponseLine, questionResponseLine } from "../rules/control-response.ts"
import { claudeArgs } from "../rules/claude-args.ts"
import { claudeRunOptions } from "../rules/run-options.ts"
import { completeTextWithClaude } from "./complete-text.ts"
import { findOnPath } from "./find-on-path.ts"
import { listClaudeModels } from "./list-models.ts"
import { controlRequestInput, decodeClaudeLine } from "../rules/decode-claude-line.ts"
import { describeExit, type ProcessExit } from "../rules/describe-exit.ts"
import { claudeSkillsFolder } from "../rules/skills-folder.ts"
import { toolActivity } from "../rules/tool-activity.ts"
import { toolKind } from "../rules/tool-kind.ts"
import { userMessageLine } from "../rules/user-message-line.ts"

const EVENT_BUFFER = 64
const STDERR_LIMIT = 8_192
const DEFAULT_KILL_GRACE: Duration.Input = "2 seconds"
const LIST_MODELS_TIMEOUT: Duration.Input = "10 seconds"
const COMPLETE_TEXT_TIMEOUT: Duration.Input = "30 seconds"

// A negative pid signals the group the child leads, with the shells and servers it started.
const signalGroup = (pid: number, signal: NodeJS.Signals) => {
  try {
    process.kill(-pid, signal)
  } catch {}
}

const TASK_OUTPUT_LIMIT = 65_536

// The last bytes of the file; a command that prints more than the limit shows its end.
const readTail = async (path: string): Promise<string> => {
  const file = await open(path, "r")
  try {
    const { size } = await file.stat()
    const length = Math.min(size, TASK_OUTPUT_LIMIT)
    const buffer = Buffer.alloc(length)
    await file.read(buffer, 0, length, size - length)
    return buffer.toString("utf8")
  } finally {
    await file.close()
  }
}

const spawnClaude = (
  sessionId: string,
  cwd: string,
  options: RunOptions,
  providerSessionId: string | null,
) => {
  const child = spawn("claude", claudeArgs(options, providerSessionId), {
    cwd,
    env: { ...process.env, IVIN_SESSION_ID: sessionId },
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
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

const listedRunOptions = (timeout: Duration.Input) => {
  let listed: HarnessRunOptions | null = null
  return Effect.suspend(() =>
    listed
      ? Effect.succeed(listed)
      : listClaudeModels(timeout).pipe(
          Effect.map((models) => {
            const options = claudeRunOptions(models)
            // An empty answer is not kept: the next question asks Claude Code again.
            if (models.length > 0) listed = options
            return options
          }),
        ),
  )
}

export const layerClaudeWith = (
  killGrace: Duration.Input,
  listTimeout: Duration.Input = LIST_MODELS_TIMEOUT,
) =>
  Layer.sync(HarnessProvider)(() =>
    HarnessProvider.of({
      id: "claude",
      runOptions: listedRunOptions(listTimeout),
      program: Effect.sync(() => ({ name: "claude", path: findOnPath("claude") })),
      skillsFolder: claudeSkillsFolder(process.env, homedir()),
      completeText: (prompt) => completeTextWithClaude(prompt, COMPLETE_TEXT_TIMEOUT),
      readTaskOutput: (path) => Effect.promise(() => readTail(path).catch(() => "")),
      toolActivity,
      toolKind,
      start: ({ sessionId, cwd, options, providerSessionId }) =>
        Effect.gen(function* () {
          // spawn reports a missing cwd as ENOENT, the same as a missing binary.
          if (!existsSync(cwd)) {
            return yield* new HarnessError({
              message: `The working folder does not exist: ${cwd}`,
            })
          }
          let stoppedByIvin = false
          const { child, lines, exited, started, stderr } = yield* Effect.acquireRelease(
            Effect.sync(() => spawnClaude(sessionId, cwd, options, providerSessionId)),
            ({ child, exited }) =>
              Effect.gen(function* () {
                stoppedByIvin = true
                child.stdin.destroy()
                // Without a pid, signalling -pid would hit this whole process group.
                const pid = child.pid
                if (pid === undefined) return
                signalGroup(pid, "SIGTERM")
                // A process that ignores SIGTERM must not hold the finalizer or outlive the app.
                yield* Effect.promise(() => exited).pipe(Effect.timeout(killGrace), Effect.ignore)
                // Children that outlived the leader, or ignored SIGTERM, die here.
                signalGroup(pid, "SIGKILL")
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
                    if (output.type === "question_request")
                      openRequests.set(output.requestId, controlRequestInput(output.raw))
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
            send: (message) =>
              Effect.callback<void, HarnessError>((resume) => {
                child.stdin.write(`${userMessageLine(message)}\n`, (error) =>
                  resume(
                    error
                      ? Effect.fail(
                          new HarnessError({
                            message: "Could not write to claude",
                            cause: error,
                          }),
                        )
                      : Effect.void,
                  ),
                )
              }),
            respond: (answer) =>
              Effect.suspend(() => {
                const { requestId } = answer
                if (!openRequests.has(requestId))
                  return Effect.fail(
                    new HarnessError({ message: `No approval request is open for ${requestId}` }),
                  )
                const input = openRequests.get(requestId)
                const line =
                  "allow" in answer
                    ? approvalResponseLine(requestId, answer.allow, input)
                    : questionResponseLine(requestId, input, answer.answers)
                return Effect.callback<void, HarnessError>((resume) => {
                  child.stdin.write(`${line}\n`, (error) =>
                    resume(
                      error
                        ? Effect.fail(
                            new HarnessError({
                              message: "Could not write to claude",
                              cause: error,
                            }),
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
    }),
  )

export const layerClaude = layerClaudeWith(DEFAULT_KILL_GRACE)
