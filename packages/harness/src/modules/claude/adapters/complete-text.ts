import { spawn } from "node:child_process"
import { tmpdir } from "node:os"
import { Duration, Effect } from "effect"
import { HarnessError } from "../../../shared/harness-provider.ts"
import { completeTextArgs, printResultOf } from "../rules/print-result.ts"

const STDOUT_LIMIT = 1 << 20

export const completeTextWithClaude = (prompt: string, timeout: Duration.Input) =>
  Effect.acquireUseRelease(
    // A folder with no project, so no CLAUDE.md or project settings come along.
    Effect.sync(() => spawn("claude", completeTextArgs, { cwd: tmpdir(), stdio: "pipe" })),
    (child) =>
      Effect.callback<string, HarnessError>((resume) => {
        let stdout = ""
        child.stdout.setEncoding("utf8")
        child.stdout.on("data", (chunk: string) => {
          if (stdout.length < STDOUT_LIMIT) stdout += chunk
        })
        child.stderr.resume()
        child.once("error", (error) =>
          resume(Effect.fail(new HarnessError({ message: error.message, cause: error }))),
        )
        child.once("close", () => {
          const result = printResultOf(stdout)
          resume(
            result.ok
              ? Effect.succeed(result.text)
              : Effect.fail(new HarnessError({ message: result.message })),
          )
        })
        child.stdin.on("error", () => {})
        child.stdin.end(prompt)
      }).pipe(
        Effect.timeoutOrElse({
          duration: timeout,
          orElse: () =>
            Effect.fail(
              new HarnessError({
                message: `Claude Code did not answer within ${Duration.format(Duration.fromInputUnsafe(timeout))}`,
              }),
            ),
        }),
      ),
    (child) =>
      Effect.sync(() => {
        // Without a pid, kill() would signal this whole process group.
        if (child.pid !== undefined && child.exitCode === null) child.kill("SIGTERM")
      }),
  )
