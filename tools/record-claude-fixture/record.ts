import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"
import { setTimeout as sleep } from "node:timers/promises"
import { initializeRequestLine } from "../../packages/harness/src/modules/claude/rules/initialize.ts"
import { userMessageLine } from "../../packages/harness/src/modules/claude/rules/user-message-line.ts"
import {
  claudeRecordingArgs,
  matches,
  permissionAnswer,
  redactLine,
  type Action,
  type LineTrigger,
  type Recording,
  type Wait,
} from "./recording.ts"

export type Outcome = { ok: true; lines: number } | { ok: false; lines: number; reason: string }

const KILL_GRACE_MS = 2_000

const actionLine = (action: Action): string => {
  switch (action.type) {
    case "send":
      return userMessageLine({ id: randomUUID(), text: action.text, images: [] })
    case "interrupt":
      return JSON.stringify({
        type: "control_request",
        request_id: randomUUID(),
        request: { subtype: "interrupt" },
      })
    case "initialize":
      return initializeRequestLine("init")
  }
}

export const record = async (recording: Recording, fixturesDir: string): Promise<Outcome> => {
  const cwd = mkdtempSync(join(tmpdir(), "ivin-record-"))
  const child = spawn("claude", claudeRecordingArgs(recording), {
    cwd,
    stdio: ["pipe", "pipe", "inherit"],
  })
  child.stdin.on("error", () => {})
  const written: string[] = []
  const waiters = new Set<{ trigger: LineTrigger; resolve: () => void }>()
  const exited = new Promise<{ code: number | null; error?: Error }>((resolve) => {
    child.once("error", (error) => resolve({ code: null, error }))
    child.once("close", (code) => resolve({ code }))
  })
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    child.kill("SIGTERM")
    setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref()
  }, recording.timeoutMs)

  const lineSeen = (trigger: LineTrigger) =>
    new Promise<void>((resolve) => waiters.add({ trigger, resolve }))
  const waitFor = (wait: Wait) => ("ms" in wait ? sleep(wait.ms) : lineSeen(wait))
  const ended = exited.then(() => undefined)

  const reading = (async () => {
    for await (const text of createInterface({ input: child.stdout, crlfDelay: Infinity })) {
      if (text.trim() === "") continue
      let line: unknown
      try {
        line = JSON.parse(text)
      } catch {
        line = text
      }
      if (recording.keep.length === 0 || recording.keep.some((keep) => matches(keep, line)))
        written.push(redactLine(text, homedir()))
      const answer = permissionAnswer(recording, line)
      if (answer !== undefined) child.stdin.write(`${answer}\n`)
      for (const waiter of waiters)
        if (matches(waiter.trigger, line)) {
          waiters.delete(waiter)
          waiter.resolve()
        }
    }
  })()

  let sent = 0
  for (const { wait, action } of recording.steps) {
    // Each line trigger counts only the lines that follow the previous step.
    if (wait !== null) await Promise.race([waitFor(wait), ended])
    if (child.exitCode !== null || child.signalCode !== null) break
    child.stdin.write(`${actionLine(action)}\n`)
    sent++
  }
  if (recording.untilWait !== null) await Promise.race([waitFor(recording.untilWait), ended])
  const untilSeen = await Promise.race([
    lineSeen(recording.until).then(() => true),
    ended.then(() => false),
  ])
  child.stdin.end()
  const { code, error } = await exited
  await reading
  clearTimeout(timer)
  rmSync(cwd, { recursive: true, force: true })

  const lines = written.length
  if (error) return { ok: false, lines, reason: `claude did not start: ${error.message}` }
  if (timedOut) return { ok: false, lines, reason: `timed out after ${recording.timeoutMs} ms` }
  if (sent < recording.steps.length)
    return { ok: false, lines, reason: `claude exited with code ${code} before step ${sent + 1}` }
  // Claude Code exits with 1 after an interrupted turn, so only a missing end line is a failure.
  if (!untilSeen)
    return { ok: false, lines, reason: `claude exited with code ${code} before the end line` }
  writeFileSync(
    join(fixturesDir, `${recording.name}.jsonl`),
    written.map((text) => `${text}\n`).join(""),
  )
  return { ok: true, lines }
}
