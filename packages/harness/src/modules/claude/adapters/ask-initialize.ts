import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import { type Duration, Effect } from "effect"
import { HarnessError } from "../../../shared/harness-provider.ts"
import { initializeRequestLine } from "../rules/initialize.ts"

const ARGS = [
  "-p",
  "--input-format",
  "stream-json",
  "--output-format",
  "stream-json",
  "--verbose",
  "--no-session-persistence",
  // A question about what Claude offers must not run the folder's hooks.
  "--settings",
  JSON.stringify({ disableAllHooks: true }),
]

// Asks a Claude Code started in `cwd` for its initialize response, and reads it with `read`.
export const askInitialize = <A>(
  cwd: string,
  read: (line: unknown, requestId: string) => A | undefined,
  timeout: Duration.Input,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => spawn("claude", ARGS, { cwd, stdio: ["pipe", "pipe", "ignore"] })),
    (child) =>
      Effect.callback<A, HarnessError>((resume) => {
        const requestId = randomUUID()
        const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
        let answered = false
        const answer = (result: Effect.Effect<A, HarnessError>) => {
          if (answered) return
          answered = true
          lines.close()
          resume(result)
        }
        lines.on("line", (text) => {
          let line: unknown
          try {
            line = JSON.parse(text)
          } catch {
            return
          }
          const value = read(line, requestId)
          if (value !== undefined) answer(Effect.succeed(value))
        })
        child.once("error", (cause) =>
          answer(Effect.fail(new HarnessError({ message: "Could not start claude", cause }))),
        )
        child.once("close", (code) =>
          answer(
            Effect.fail(
              new HarnessError({ message: `claude exited with code ${code} before answering` }),
            ),
          ),
        )
        child.stdin.on("error", () => {})
        child.stdin.write(`${initializeRequestLine(requestId)}\n`)
      }).pipe(
        Effect.timeoutOrElse({
          duration: timeout,
          orElse: () => Effect.fail(new HarnessError({ message: "claude did not answer in time" })),
        }),
      ),
    (child) =>
      Effect.sync(() => {
        child.stdin.destroy()
        // Without a pid, kill() would signal this whole process group.
        if (child.pid !== undefined) child.kill("SIGTERM")
      }),
  )
