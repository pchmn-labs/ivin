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
  let requested = () => {}
  const requestSeen = new Promise<void>((resolve) => (requested = resolve))
  const listening = createServer((socket) => socket.once("data", requested))
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
        yield* Effect.promise(() => requestSeen)
        yield* TestClock.adjust("30 seconds")
        return yield* Fiber.join(fiber)
      }).pipe(Effect.provide(TestClock.layer())),
    )

    expect(JSON.stringify(error)).toContain("NoAnswer")
  } finally {
    listening.close()
  }
})
