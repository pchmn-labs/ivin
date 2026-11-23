import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { afterEach, beforeEach, expect, test } from "vitest"
import { record } from "./record.ts"
import { parseRecording, type Recording } from "./recording.ts"

// Answers a user message with a result, and exits 1 as Claude Code does after an interrupt.
const FAKE_CLAUDE = `#!/bin/sh
printf '{"type":"system","subtype":"init","cwd":"%s"}\\n' "$PWD"
while IFS= read -r line; do
  printf '{"type":"echo","line":%s}\\n' "$line"
  case "$line" in *'"type":"user"'*) printf '{"type":"result","subtype":"success"}\\n';; esac
done
exit 1
`

const path = process.env["PATH"]
let fixtures: string

beforeEach(() => {
  const bin = mkdtempSync(join(tmpdir(), "ivin-fake-claude-"))
  writeFileSync(join(bin, "claude"), FAKE_CLAUDE)
  chmodSync(join(bin, "claude"), 0o755)
  process.env["PATH"] = `${bin}${delimiter}${path ?? ""}`
  fixtures = mkdtempSync(join(tmpdir(), "ivin-fixtures-"))
})

afterEach(() => {
  process.env["PATH"] = path
})

const recording = (...argv: string[]): Recording => {
  const result = parseRecording(argv)
  if (typeof result === "string") throw new Error(result)
  return result
}

const lines = (name: string) =>
  readFileSync(join(fixtures, `${name}.jsonl`), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>)

test("every stdout line lands in the fixture, from a run in a temporary folder removed after", async () => {
  const outcome = await record(recording("plain", "--send", "hi"), fixtures)

  const written = lines("plain")
  expect(outcome).toEqual({ ok: true, lines: 3 })
  expect(written.map((line) => line["type"])).toEqual(["system", "echo", "result"])
  expect(written[1]).toMatchObject({
    line: { type: "user", message: { role: "user", content: [{ type: "text", text: "hi" }] } },
  })
  const cwd = written[0]!["cwd"] as string
  expect(cwd).toContain("ivin-record-")
  expect(existsSync(cwd)).toBe(false)
})

test("steps go out in order, each after its wait, and only kept lines are written", async () => {
  const outcome = await record(
    recording(
      "steps",
      "--initialize",
      "--wait",
      "echo",
      "--send",
      "go",
      "--wait",
      "1ms",
      "--interrupt",
      "--until",
      "echo",
      "--keep",
      "echo",
    ),
    fixtures,
  )

  expect(outcome.ok).toBe(true)
  expect(
    lines("steps").map((line) => {
      const sent = line["line"] as { type: string; request?: { subtype: string } }
      return sent.request?.subtype ?? sent.type
    }),
  ).toEqual(["initialize", "user", "interrupt"])
})

test("a run that outlives its timeout is killed and reported", async () => {
  const outcome = await record(
    { ...recording("slow", "--send", "hi", "--until", "never"), timeoutMs: 50 },
    fixtures,
  )

  expect(outcome).toMatchObject({ ok: false })
  expect(outcome.ok === false && outcome.reason).toMatch(/timed out/)
  expect(existsSync(join(fixtures, "slow.jsonl"))).toBe(false)
})
