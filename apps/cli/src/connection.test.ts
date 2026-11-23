import { Effect, Fiber } from "effect"
import { TestClock } from "effect/testing"
import { mkdtempSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { Server, withServer } from "./connection.ts"

test("a server that accepts and never answers fails the command at its time limit", async () => {
  const socketPath = join(mkdtempSync(join(tmpdir(), "ivin-cli-")), "ivin.sock")
  const listening = createServer(() => {})
  await new Promise<void>((resolve) => listening.listen(socketPath, resolve))

  try {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* withServer(
          socketPath,
          Effect.gen(function* () {
            const { client } = yield* Server
            return yield* client["setting.get"]({ path: null })
          }).pipe(Effect.catchTag("RpcClientError", Effect.die)),
        ).pipe(Effect.flip, Effect.forkChild)
        // The limit starts once the socket is open, which takes real time.
        while (fiber.pollUnsafe() === undefined) {
          yield* TestClock.adjust("30 seconds")
          yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 5)))
        }
        return yield* Fiber.join(fiber)
      }).pipe(Effect.provide(TestClock.layer())),
    )

    expect(JSON.stringify(error)).toContain("NoAnswer")
  } finally {
    listening.close()
  }
})
