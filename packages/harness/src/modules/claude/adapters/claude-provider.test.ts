import { existsSync, mkdtempSync } from "node:fs"
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
