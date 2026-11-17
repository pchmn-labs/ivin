import { mkdtempSync } from "node:fs"
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
