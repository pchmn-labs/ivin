import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect, Stream } from "effect"
import { expect, test } from "vitest"
import { HarnessProvider } from "../../../shared/harness-provider.ts"
import { layerClaude } from "./claude-provider.ts"

// Spawns the real `claude` CLI and calls the API; kept out of CI.
const real = process.env["IVIN_TEST_CLAUDE"] === "1" ? test : test.skip

real(
  "a message sent to the real claude CLI streams back an answer, usage and idle",
  async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ivin-claude-"))
    const outputs = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd,
          model: "haiku",
          providerSessionId: null,
        })
        yield* harness.send({ text: "Reply with exactly: pong" })
        return yield* Stream.runCollect(
          Stream.takeUntil(harness.events, (o) => o.type === "status" && o.status === "idle"),
        )
      }).pipe(Effect.provide(layerClaude), Effect.scoped),
    )

    expect(outputs.some((o) => o.type === "delta")).toBe(true)
    expect(outputs.find((o) => o.type === "assistant_text")).toMatchObject({ text: "pong" })
    expect(outputs.some((o) => o.type === "usage")).toBe(true)
  },
  60_000,
)

real.each([
  { allow: true, isError: false, made: true },
  { allow: false, isError: true, made: false },
])(
  "the real claude CLI waits for an approval and runs the tool only once allowed (allow: $allow)",
  async ({ allow, isError, made }) => {
    const cwd = mkdtempSync(join(tmpdir(), "ivin-claude-"))
    const outputs = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd,
          model: "haiku",
          providerSessionId: null,
        })
        yield* harness.send({
          text: "Run the shell command `touch made.txt` with the Bash tool. Do nothing else.",
        })
        return yield* Stream.runCollect(
          harness.events.pipe(
            Stream.tap((o) =>
              o.type === "approval_request"
                ? Effect.sync(() => expect(existsSync(join(cwd, "made.txt"))).toBe(false)).pipe(
                    Effect.andThen(harness.respond({ requestId: o.requestId, allow })),
                  )
                : Effect.void,
            ),
            Stream.takeUntil((o) => o.type === "status" && o.status === "idle"),
          ),
        )
      }).pipe(Effect.provide(layerClaude), Effect.scoped),
    )

    expect(outputs.find((o) => o.type === "approval_request")).toMatchObject({ name: "Bash" })
    expect(outputs.find((o) => o.type === "tool_result")).toMatchObject({ isError })
    expect(existsSync(join(cwd, "made.txt"))).toBe(made)
  },
  90_000,
)

test("a process that fails to start ends the stream with a HarnessError", async () => {
  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      const harness = yield* (yield* HarnessProvider).start({
        sessionId: "s1",
        cwd: "/does/not/exist",
        model: "haiku",
        providerSessionId: null,
      })
      return yield* Stream.runCollect(harness.events)
    }).pipe(Effect.provide(layerClaude), Effect.scoped),
  )

  expect(exit._tag).toBe("Failure")
})

test("answering a request that is not open fails with a HarnessError", async () => {
  const error = await Effect.runPromise(
    Effect.gen(function* () {
      const harness = yield* (yield* HarnessProvider).start({
        sessionId: "s1",
        cwd: tmpdir(),
        model: "haiku",
        providerSessionId: null,
      })
      return yield* Effect.flip(harness.respond({ requestId: "nope", allow: true }))
    }).pipe(Effect.provide(layerClaude), Effect.scoped),
  )

  expect(error._tag).toBe("HarnessError")
})

// A stand-in `claude` on the PATH, so the adapter's stdin and signal handling run without the API.
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

const logStdin = `
const fs = require("node:fs")
process.stdin.on("data", (d) => fs.appendFileSync(process.env.FAKE_LOG ?? "stdin.log", d))
`

test("interrupt writes a control request to stdin and keeps the process alive", async () => {
  await withFakeClaude(
    `${logStdin}
setInterval(() => {}, 1000)`,
    async (dir) => {
      const log = join(dir, "stdin.log")
      process.env["FAKE_LOG"] = log
      await Effect.runPromise(
        Effect.gen(function* () {
          const harness = yield* (yield* HarnessProvider).start({
            sessionId: "s1",
            cwd: dir,
            model: "haiku",
            providerSessionId: null,
          })
          yield* harness.interrupt
          yield* Effect.sleep("300 millis")
        }).pipe(Effect.provide(layerClaude), Effect.scoped),
      )

      const [line] = readFileSync(log, "utf8").trim().split("\n")
      expect(JSON.parse(line!)).toMatchObject({
        type: "control_request",
        request: { subtype: "interrupt" },
      })
      expect(JSON.parse(line!).request_id).toEqual(expect.any(String))
    },
  )
})

test("closing the scope kills a process that ignores SIGTERM", async () => {
  await withFakeClaude(
    `process.on("SIGTERM", () => {})
require("node:fs").writeFileSync(process.env.FAKE_PID, String(process.pid))
setInterval(() => {}, 1000)`,
    async (dir) => {
      const pidFile = join(dir, "pid")
      process.env["FAKE_PID"] = pidFile
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* (yield* HarnessProvider).start({
            sessionId: "s1",
            cwd: dir,
            model: "haiku",
            providerSessionId: null,
          })
          yield* Effect.sleep("500 millis")
        }).pipe(Effect.provide(layerClaude), Effect.scoped),
      )

      const pid = Number(readFileSync(pidFile, "utf8"))
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(() => process.kill(pid, 0)).toThrow()
    },
  )
}, 15_000)

test("start fails with plain words when claude is not on the PATH", async () => {
  const path = process.env["PATH"]
  process.env["PATH"] = mkdtempSync(join(tmpdir(), "ivin-empty-path-"))
  try {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd: tmpdir(),
          model: "haiku",
          providerSessionId: null,
        })
      }).pipe(Effect.provide(layerClaude), Effect.scoped),
    )

    expect(JSON.stringify(exit)).toContain("Claude Code is not installed")
  } finally {
    process.env["PATH"] = path
  }
})

test("start names a project folder that does not exist", async () => {
  const exit = await Effect.runPromiseExit(
    Effect.gen(function* () {
      yield* (yield* HarnessProvider).start({
        sessionId: "s1",
        cwd: "/does/not/exist",
        model: "haiku",
        providerSessionId: null,
      })
    }).pipe(Effect.provide(layerClaude), Effect.scoped),
  )

  expect(JSON.stringify(exit)).toContain("The project folder does not exist: /does/not/exist")
})

test("closing the scope returns within a bound when a grandchild holds the pipes open", async () => {
  await withFakeClaude(
    `require("node:child_process").spawn("sleep", ["5"], { stdio: "inherit", detached: true }).unref()
setInterval(() => {}, 1000)`,
    async (dir) => {
      const started = Date.now()
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* (yield* HarnessProvider).start({
            sessionId: "s1",
            cwd: dir,
            model: "haiku",
            providerSessionId: null,
          })
          yield* Effect.sleep("500 millis")
        }).pipe(Effect.provide(layerClaude), Effect.scoped),
      )

      expect(Date.now() - started).toBeLessThan(3_000)
    },
  )
}, 15_000)
