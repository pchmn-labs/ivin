import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { homedir } from "node:os"
import { createInterface } from "node:readline"
import type { OfferedModel } from "@ivin/contracts/session"
import { type Duration, Effect } from "effect"
import { initializeRequestLine, modelsFromInitialize } from "../rules/initialize.ts"

const ARGS = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"]

// Empty when Claude Code is missing, fails or does not answer in time.
export const listClaudeModels = (timeout: Duration.Input) =>
  Effect.acquireUseRelease(
    // The home folder, so no project's hooks run for a question about the account.
    Effect.sync(() => spawn("claude", ARGS, { cwd: homedir(), stdio: ["pipe", "pipe", "ignore"] })),
    (child) =>
      Effect.callback<OfferedModel[]>((resume) => {
        const requestId = randomUUID()
        const lines = createInterface({ input: child.stdout, crlfDelay: Infinity })
        let answered = false
        const answer = (models: OfferedModel[]) => {
          if (answered) return
          answered = true
          lines.close()
          resume(Effect.succeed(models))
        }
        lines.on("line", (text) => {
          let line: unknown
          try {
            line = JSON.parse(text)
          } catch {
            return
          }
          const models = modelsFromInitialize(line, requestId)
          if (models !== undefined) answer(models)
        })
        child.once("error", () => answer([]))
        child.once("close", () => answer([]))
        child.stdin.on("error", () => {})
        child.stdin.write(`${initializeRequestLine(requestId)}\n`)
      }).pipe(Effect.timeoutOrElse({ duration: timeout, orElse: () => Effect.succeed([]) })),
    (child) =>
      Effect.sync(() => {
        child.stdin.destroy()
        // Without a pid, kill() would signal this whole process group.
        if (child.pid !== undefined) child.kill("SIGTERM")
      }),
  )
