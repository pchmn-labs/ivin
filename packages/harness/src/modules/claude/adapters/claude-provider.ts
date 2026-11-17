import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, Layer, Stream } from "effect"
import { HarnessError, HarnessProvider, type HarnessRun } from "../../../shared/harness-provider.ts"
import { decodeClaudeLine } from "../rules/decode-claude-line.ts"

const EVENT_BUFFER = 64
const STDERR_LIMIT = 8_192

const ARGS = [
  "-p",
  "--output-format",
  "stream-json",
  "--input-format",
  "stream-json",
  "--verbose",
  "--include-partial-messages",
  // Without it the thinking blocks come back empty.
  "--thinking-display",
  "summarized",
]

type Exit =
  | { readonly error: Error }
  | { readonly code: number | null; readonly signal: string | null }

export const claudeArgs = (model: string, resume: string | null) => [
  ...ARGS,
  "--model",
  model,
  ...(resume === null ? [] : ["--resume", resume]),
]

const spawnClaude = (sessionId: string, cwd: string, model: string, resume: string | null) => {
  const child = spawn("claude", claudeArgs(model, resume), {
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
  const exited = new Promise<Exit>((resolve) => {
    child.once("error", (error) => {
      // A process that never started leaves stdout open, which would stall the stream.
      readline.close()
      resolve({ error })
    })
    child.once("close", (code, signal) => resolve({ code, signal }))
  })
  // A failed write (the process is gone) is reported by `exited`; an unhandled stream error would crash the app.
  child.stdin.on("error", () => {})
  return { child, lines, exited, stderr: () => stderr.trim() }
}

const describeExit = (exit: Exit, stderr: string) => {
  const what =
    "error" in exit
      ? `Could not start claude: ${exit.error.message}`
      : `claude exited (${exit.signal ?? `code ${exit.code}`})`
  return stderr === "" ? what : `${what}: ${stderr}`
}

export const layerClaude = Layer.succeed(HarnessProvider)({
  id: "claude",
  start: ({ sessionId, cwd, model, resume }) =>
    Effect.gen(function* () {
      const { child, lines, exited, stderr } = yield* Effect.acquireRelease(
        Effect.sync(() => spawnClaude(sessionId, cwd, model, resume)),
        ({ child }) =>
          Effect.sync(() => {
            child.stdin.destroy()
            child.kill()
          }),
      )

      const ended = Stream.fromEffect(
        Effect.promise(() => exited).pipe(
          Effect.flatMap((exit) =>
            Effect.fail(new HarnessError({ message: describeExit(exit, stderr()), cause: exit })),
          ),
        ),
      )
      const events = Stream.unwrap(
        Effect.sync(() => {
          let lastStatus: string | undefined
          return Stream.fromAsyncIterable(
            lines,
            (cause) => new HarnessError({ message: "Could not read claude's output", cause }),
          ).pipe(
            Stream.map(decodeClaudeLine),
            Stream.flattenIterable,
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
        respond: () => Effect.void,
        interrupt: Effect.void,
      }
      return run
    }),
})
