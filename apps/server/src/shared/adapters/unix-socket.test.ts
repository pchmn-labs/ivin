import { Effect, Exit } from "effect"
import { existsSync, lstatSync, mkdtempSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { expect, test } from "vitest"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { listenOnUnixSocket } from "./unix-socket.ts"

const idle = () => Effect.never
const tempSocketPath = () => join(mkdtempSync(join(tmpdir(), "ivin-")), "s.sock")

test("the socket is readable and writable by its owner only, and removed when the scope closes", async () => {
  const path = tempSocketPath()
  const mode = await Effect.runPromise(
    listenOnUnixSocket(path, idle).pipe(
      Effect.andThen(Effect.sync(() => lstatSync(path))),
      Effect.scoped,
    ),
  )

  expect(mode.isSocket()).toBe(true)
  expect(mode.mode & 0o777).toBe(0o600)
  expect(existsSync(path)).toBe(false)
})

test("a stale file left by a crash is replaced", async () => {
  const path = tempSocketPath()
  writeFileSync(path, "")

  const isSocket = await Effect.runPromise(
    listenOnUnixSocket(path, idle).pipe(
      Effect.andThen(Effect.sync(() => lstatSync(path).isSocket())),
      Effect.scoped,
    ),
  )

  expect(isSocket).toBe(true)
})

test("a socket another process answers on is left alone", async () => {
  const path = tempSocketPath()
  const other = createServer()
  await new Promise<void>((resolve) => other.listen(path, resolve))
  try {
    const exit = await Effect.runPromiseExit(listenOnUnixSocket(path, idle).pipe(Effect.scoped))

    expect(Exit.isFailure(exit) && JSON.stringify(exit.cause)).toContain("SocketInUse")
    expect(lstatSync(path).isSocket()).toBe(true)
  } finally {
    other.close()
  }
})
