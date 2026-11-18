import { layerScripted } from "@ivin/harness"
import { Rpcs } from "@ivin/contracts/rpcs"
import { Effect, Layer } from "effect"
import { RpcTest } from "effect/rpc"
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { expect, test } from "vitest"
import { layerErrorLogFile } from "../modules/log/adapters/error-log-file.ts"
import { ServerInfo } from "../modules/server/usecases/server-info.ts"
import { Database } from "../shared/adapters/database.ts"
import { runMigrations } from "../shared/adapters/migrations.ts"
import { handlers, layerServices } from "./handlers.ts"

const makeClient = () => RpcTest.makeClient(Rpcs)

const withServer = <A, E>(
  logPath: string,
  use: (client: Effect.Success<ReturnType<typeof makeClient>>) => Effect.Effect<A, E>,
) => {
  const db = new DatabaseSync(":memory:")
  Effect.runSync(runMigrations(db))
  return Effect.runPromise(
    makeClient().pipe(
      Effect.flatMap(use),
      Effect.provide(
        handlers.pipe(
          Layer.provide(layerServices),
          Layer.provide(Layer.succeed(ServerInfo)({ version: "1.2.3" })),
          Layer.provide(Layer.succeed(Database)(db)),
          Layer.provide(layerScripted([])),
        ),
      ),
      Effect.provide(layerErrorLogFile(logPath)),
      Effect.scoped,
    ),
  )
}

const tempLogPath = () => join(mkdtempSync(join(tmpdir(), "ivin-log-")), "logs", "ivin.log")
const readLines = (path: string) =>
  readFileSync(path, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))

test("a failed RPC handler adds a server line to a log file it creates", async () => {
  const logPath = tempLogPath()

  await withServer(logPath, (client) => Effect.flip(client["project.select"]({ path: "/a/none" })))

  const [line, ...rest] = readLines(logPath)
  expect(rest).toEqual([])
  expect(line).toMatchObject({ source: "server", action: "project.select", type: "ProjectNotOpen" })
  expect(Date.parse(line.time)).not.toBeNaN()
})

test("an RPC that succeeds writes nothing", async () => {
  const logPath = tempLogPath()

  await withServer(logPath, (client) => client["project.list"]())

  expect(() => readFileSync(logPath)).toThrow()
})

test("an error the UI reports adds a ui line", async () => {
  const logPath = tempLogPath()

  await withServer(logPath, (client) =>
    client["log.writeError"]({
      action: "uncaught error",
      type: "TypeError",
      message: "x is undefined",
      stack: "TypeError: x is undefined\n    at app.js:1",
    }),
  )

  expect(readLines(logPath)).toEqual([
    {
      time: expect.any(String),
      source: "ui",
      action: "uncaught error",
      type: "TypeError",
      message: "x is undefined",
      stack: "TypeError: x is undefined\n    at app.js:1",
    },
  ])
})

test("a log file that cannot be written leaves the failed RPC's error unchanged", async () => {
  const blocker = join(mkdtempSync(join(tmpdir(), "ivin-log-")), "file")
  writeFileSync(blocker, "")

  const error = await withServer(join(blocker, "logs", "ivin.log"), (client) =>
    Effect.flip(client["project.select"]({ path: "/a/none" })),
  )

  expect(error).toMatchObject({ _tag: "ProjectNotOpen", path: "/a/none" })
})

test("a failed harness run adds a server line", async () => {
  const logPath = tempLogPath()

  await withServer(logPath, (client) =>
    Effect.gen(function* () {
      const session = yield* client["session.create"]({ projectPath: "/p", model: "sonnet" })
      yield* client["session.sendMessage"]({ sessionId: session.id, messageId: "m1", text: "go" })
    }),
  )

  expect(readLines(logPath)).toMatchObject([
    {
      source: "server",
      action: "harness run",
      type: "HarnessError",
      message: "The scripted harness has no turn left",
    },
  ])
})
