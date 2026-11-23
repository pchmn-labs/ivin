import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { expect, test, vi } from "vitest"
import { completeTextWithClaude } from "./complete-text.ts"

vi.setConfig({ testTimeout: 10_000 })

const withFakeClaude = async <A>(body: string, use: (dir: string) => Promise<A>): Promise<A> => {
  const dir = mkdtempSync(join(tmpdir(), "ivin-fake-claude-"))
  const bin = join(dir, "claude")
  writeFileSync(bin, `#!/usr/bin/env node\n${body}`)
  chmodSync(bin, 0o755)
  const path = process.env["PATH"]
  process.env["PATH"] = `${dir}:${path}`
  try {
    return await use(dir)
  } finally {
    process.env["PATH"] = path
  }
}

test("the prompt goes to Claude Code on stdin, with haiku and nothing of the user's loaded, and its reply comes back", async () => {
  const run = await withFakeClaude(
    `
const fs = require("node:fs")
const prompt = fs.readFileSync(0, "utf8")
fs.writeFileSync(process.env.FAKE_LOG, JSON.stringify({ args: process.argv.slice(2), prompt }))
process.stdout.write(JSON.stringify({ type: "result", is_error: false, result: "pong" }))
`,
    async (dir) => {
      const log = join(dir, "log.json")
      process.env["FAKE_LOG"] = log
      const reply = await Effect.runPromise(completeTextWithClaude("ping", "5 seconds"))
      return { reply, ...JSON.parse(readFileSync(log, "utf8")) }
    },
  )

  expect(run.reply).toBe("pong")
  expect(run.prompt).toBe("ping")
  expect(run.args).toEqual([
    "-p",
    "--model",
    "haiku",
    "--output-format",
    "json",
    "--tools",
    "",
    "--no-session-persistence",
    "--disable-slash-commands",
    "--setting-sources",
    "",
    "--strict-mcp-config",
  ])
})

test("a failed reply, an exit without a result, or no answer in time is a HarnessError", async () => {
  const failed = await withFakeClaude(
    `process.stdout.write(JSON.stringify({ type: "result", is_error: true, result: "Not logged in" }))`,
    () => Effect.runPromise(Effect.flip(completeTextWithClaude("ping", "5 seconds"))),
  )
  const crashed = await withFakeClaude(`process.stderr.write("boom"); process.exit(1)`, () =>
    Effect.runPromise(Effect.flip(completeTextWithClaude("ping", "5 seconds"))),
  )
  const silent = await withFakeClaude(`setInterval(() => {}, 1000)`, () =>
    Effect.runPromise(Effect.flip(completeTextWithClaude("ping", "200 millis"))),
  )

  expect(failed.message).toBe("Not logged in")
  expect(crashed.message).toContain("printed no result")
  expect(silent.message).toContain("did not answer")
})
