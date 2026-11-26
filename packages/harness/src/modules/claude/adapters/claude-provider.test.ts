import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Effect, Stream } from "effect"
import { expect, test, vi } from "vitest"
import { HarnessProvider } from "../../../shared/harness-provider.ts"
import { FALLBACK_MODELS } from "../rules/run-options.ts"
import { layerClaude, layerClaudeWith } from "./claude-provider.ts"

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
          options: { model: "haiku", effort: "low", permissionMode: "manual" },
          providerSessionId: null,
        })
        yield* harness.send({
          id: crypto.randomUUID(),
          text: "Reply with exactly: pong",
          images: [],
        })
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

real(
  "the real claude CLI ends an interrupted turn with an interruption and idle, and keeps its process",
  async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ivin-claude-"))
    const outputs = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd,
          options: { model: "haiku", effort: "low", permissionMode: "manual" },
          providerSessionId: null,
        })
        yield* harness.send({
          id: crypto.randomUUID(),
          text: "Count from 1 to 500, one number per line.",
          images: [],
        })
        const seen: HarnessOutput[] = []
        yield* Stream.runForEach(
          Stream.takeUntil(harness.events, (o) => o.type === "status" && o.status === "idle"),
          (output) =>
            Effect.suspend(() => {
              seen.push(output)
              return output.type === "delta" && seen.filter((o) => o.type === "delta").length === 1
                ? harness.interrupt
                : Effect.void
            }),
        )
        return seen
      }).pipe(Effect.provide(layerClaude), Effect.scoped),
    )

    expect(outputs.some((o) => o.type === "interruption")).toBe(true)
    expect(outputs.at(-1)).toMatchObject({ type: "status", status: "idle" })
  },
  60_000,
)

// A 32×32 square of a single red.
const RED_SQUARE =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR4nGN4ampNU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULANjfVEx+wBeAAAAAAElFTkSuQmCC"

real(
  "an image sent with a message reaches the real claude CLI, which describes it",
  async () => {
    const cwd = mkdtempSync(join(tmpdir(), "ivin-claude-"))
    const outputs = await Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd,
          options: { model: "haiku", effort: "low", permissionMode: "manual" },
          providerSessionId: null,
        })
        yield* harness.send({
          id: crypto.randomUUID(),
          text: "What single colour fills [Image #1]? Answer with one lowercase word.",
          images: [{ id: "i1", number: 1, mediaType: "image/png", base64: RED_SQUARE }],
        })
        return yield* Stream.runCollect(
          Stream.takeUntil(harness.events, (o) => o.type === "status" && o.status === "idle"),
        )
      }).pipe(Effect.provide(layerClaude), Effect.scoped),
    )

    const answer = outputs.find((o) => o.type === "assistant_text")
    expect(answer?.type === "assistant_text" && answer.text.toLowerCase()).toContain("red")
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
          options: { model: "haiku", effort: "low", permissionMode: "manual" },
          providerSessionId: null,
        })
        yield* harness.send({
          id: crypto.randomUUID(),
          text: "Run the shell command `touch made.txt` with the Bash tool. Do nothing else.",
          images: [],
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
        options: { model: "haiku", effort: "low", permissionMode: "manual" },
        providerSessionId: null,
      })
      return yield* Stream.runCollect(harness.events)
    }).pipe(Effect.provide(layerClaude), Effect.scoped),
  )

  expect(exit._tag).toBe("Failure")
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

test("answering a request that is not open fails with a HarnessError", async () => {
  const error = await withFakeClaude("setInterval(() => {}, 1000)", (dir) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const harness = yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd: dir,
          options: { model: "haiku", effort: "low", permissionMode: "manual" },
          providerSessionId: null,
        })
        return yield* Effect.flip(harness.respond({ requestId: "nope", allow: true }))
      }).pipe(Effect.provide(layerClaude), Effect.scoped),
    ),
  )

  expect(error._tag).toBe("HarnessError")
})

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
            options: { model: "haiku", effort: "low", permissionMode: "manual" },
            providerSessionId: null,
          })
          yield* harness.interrupt
          yield* Effect.promise(() =>
            vi.waitFor(() => expect(existsSync(log) && readFileSync(log, "utf8")).toContain("\n"), {
              timeout: 800,
            }),
          )
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

test("stopTask writes a stop_task control request for the task to stdin", async () => {
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
            options: { model: "haiku", effort: "low", permissionMode: "manual" },
            providerSessionId: null,
          })
          yield* harness.stopTask("b1a2")
          yield* Effect.promise(() =>
            vi.waitFor(() => expect(existsSync(log) && readFileSync(log, "utf8")).toContain("\n"), {
              timeout: 800,
            }),
          )
        }).pipe(Effect.provide(layerClaude), Effect.scoped),
      )

      const [line] = readFileSync(log, "utf8").trim().split("\n")
      expect(JSON.parse(line!)).toMatchObject({
        type: "control_request",
        request: { subtype: "stop_task", task_id: "b1a2" },
      })
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
            options: { model: "haiku", effort: "low", permissionMode: "manual" },
            providerSessionId: null,
          })
          yield* Effect.promise(() => vi.waitFor(() => expect(existsSync(pidFile)).toBe(true)))
        }).pipe(Effect.provide(layerClaudeWith("100 millis")), Effect.scoped),
      )

      const pid = Number(readFileSync(pidFile, "utf8"))
      await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow())
    },
  )
})

test("closing the scope kills the shells the agent started, which ignore SIGTERM", async () => {
  await withFakeClaude(
    `process.on("SIGTERM", () => {})
const sleeper = require("node:child_process").spawn("sh", ["-c", "trap '' TERM; exec sleep 30"], { stdio: "ignore" })
require("node:fs").writeFileSync(process.env.FAKE_PID, String(sleeper.pid))
setInterval(() => {}, 1000)`,
    async (dir) => {
      const pidFile = join(dir, "pid")
      process.env["FAKE_PID"] = pidFile
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* (yield* HarnessProvider).start({
            sessionId: "s1",
            cwd: dir,
            options: { model: "haiku", effort: "low", permissionMode: "manual" },
            providerSessionId: null,
          })
          yield* Effect.promise(() => vi.waitFor(() => expect(existsSync(pidFile)).toBe(true)))
        }).pipe(Effect.provide(layerClaudeWith("100 millis")), Effect.scoped),
      )

      const pid = Number(readFileSync(pidFile, "utf8"))
      await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow())
    },
  )
})

test("start fails with plain words when claude is not on the PATH", async () => {
  const path = process.env["PATH"]
  process.env["PATH"] = mkdtempSync(join(tmpdir(), "ivin-empty-path-"))
  try {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        yield* (yield* HarnessProvider).start({
          sessionId: "s1",
          cwd: tmpdir(),
          options: { model: "haiku", effort: "low", permissionMode: "manual" },
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
        options: { model: "haiku", effort: "low", permissionMode: "manual" },
        providerSessionId: null,
      })
    }).pipe(Effect.provide(layerClaude), Effect.scoped),
  )

  expect(JSON.stringify(exit)).toContain("The working folder does not exist: /does/not/exist")
})

test("closing the scope returns within a bound when a grandchild holds the pipes open", async () => {
  await withFakeClaude(
    `require("node:child_process").spawn("sleep", ["5"], { stdio: "inherit", detached: true }).unref()
require("node:fs").writeFileSync("grandchild-started", "")
setInterval(() => {}, 1000)`,
    async (dir) => {
      const grandchildStartedAt = await Effect.runPromise(
        Effect.gen(function* () {
          yield* (yield* HarnessProvider).start({
            sessionId: "s1",
            cwd: dir,
            options: { model: "haiku", effort: "low", permissionMode: "manual" },
            providerSessionId: null,
          })
          yield* Effect.promise(() =>
            expect.poll(() => existsSync(join(dir, "grandchild-started"))).toBe(true),
          )
          return Date.now()
        }).pipe(Effect.provide(layerClaudeWith("100 millis")), Effect.scoped),
      )

      expect(Date.now() - grandchildStartedAt).toBeLessThan(500)
    },
  )
})

// Answers the initialize request with one listed model, and counts its starts in FAKE_LOG.
const answerInitialize = `
const fs = require("node:fs")
fs.appendFileSync(process.env.FAKE_LOG, "start\\n")
require("node:readline").createInterface({ input: process.stdin }).on("line", (text) => {
  const { request_id } = JSON.parse(text)
  const models = [{ value: "opus", displayName: "Opus 9", description: "Big", supportedEffortLevels: ["low"] }]
  console.log(JSON.stringify({ type: "control_response", response: { subtype: "success", request_id, response: { models } } }))
})
setInterval(() => {}, 1000)`

const listedModels = (layer = layerClaude) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { runOptions } = yield* HarnessProvider
      return [yield* runOptions, yield* runOptions]
    }).pipe(Effect.provide(layer)),
  )

test("the models are the ones Claude Code lists, asked for once", async () => {
  await withFakeClaude(answerInitialize, async (dir) => {
    process.env["FAKE_LOG"] = join(dir, "starts.log")
    const [first, second] = await listedModels()

    expect(first!.model.values).toEqual([
      { value: "opus", name: "Opus 9", description: "Big", efforts: ["low"], older: false },
    ])
    expect(second).toEqual(first)
    expect(readFileSync(join(dir, "starts.log"), "utf8")).toBe("start\n")
  })
})

test("a Claude Code that does not answer in time gives the fixed models, asked for again at the next question", async () => {
  await withFakeClaude(
    `require("node:fs").appendFileSync(process.env.FAKE_LOG, "start\\n")
setInterval(() => {}, 1000)`,
    async (dir) => {
      process.env["FAKE_LOG"] = join(dir, "starts.log")
      const [first, second] = await listedModels(layerClaudeWith("100 millis", "1500 millis"))

      expect(first!.model.values).toEqual(FALLBACK_MODELS)
      expect(second!.model.values).toEqual(FALLBACK_MODELS)
      expect(readFileSync(join(dir, "starts.log"), "utf8")).toBe("start\nstart\n")
    },
  )
}, 10_000)

test("the program is the claude found first on the PATH, or none when it is missing", async () => {
  const program = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* HarnessProvider).program
      }).pipe(Effect.provide(layerClaude)),
    )
  await withFakeClaude("", async (dir) => {
    expect(await program()).toEqual({ name: "claude", path: join(dir, "claude") })
  })

  const path = process.env["PATH"]
  process.env["PATH"] = mkdtempSync(join(tmpdir(), "ivin-empty-path-"))
  try {
    expect(await program()).toEqual({ name: "claude", path: null })
  } finally {
    process.env["PATH"] = path
  }
})

// Lists FAKE_COMMANDS on initialize and FAKE_RUN_COMMANDS in a run's first line; logs each start's folder and hooks setting.
const answerCommands = `
const fs = require("node:fs")
const settings = process.argv[process.argv.indexOf("--settings") + 1]
fs.appendFileSync(process.env.FAKE_LOG, process.cwd() + " " + settings + "\\n")
const names = (variable) => fs.readFileSync(process.env[variable], "utf8").split(",")
require("node:readline").createInterface({ input: process.stdin }).on("line", (text) => {
  const line = JSON.parse(text)
  if (line.type === "control_request") {
    const commands = names("FAKE_COMMANDS").map((name) => ({ name, description: "Does " + name, argumentHint: "" }))
    console.log(JSON.stringify({ type: "control_response", response: { subtype: "success", request_id: line.request_id, response: { commands } } }))
  } else {
    const slash_commands = names("FAKE_RUN_COMMANDS")
    console.log(JSON.stringify({ type: "system", subtype: "init", session_id: "p1", slash_commands, skills: slash_commands, terminal_slash_commands: [] }))
  }
})
setInterval(() => {}, 1000)`

const withFakeCommands = (
  use: (
    dir: string,
    list: (names: string) => void,
    runLists: (names: string) => void,
  ) => Promise<void>,
) =>
  withFakeClaude(answerCommands, async (dir) => {
    process.env["FAKE_LOG"] = join(dir, "starts.log")
    process.env["FAKE_COMMANDS"] = join(dir, "commands")
    process.env["FAKE_RUN_COMMANDS"] = join(dir, "run-commands")
    await use(
      dir,
      (names) => writeFileSync(join(dir, "commands"), names),
      (names) => writeFileSync(join(dir, "run-commands"), names),
    )
  })

const listCommandsIn = (cwd: string) =>
  Effect.gen(function* () {
    const { listCommands } = yield* HarnessProvider
    return (yield* listCommands!(cwd)).map((command) => command.name)
  })

const runOnce = (cwd: string) =>
  Effect.gen(function* () {
    const run = yield* (yield* HarnessProvider).start({
      sessionId: "s1",
      cwd,
      options: { model: "haiku", effort: "low", permissionMode: "manual" },
      providerSessionId: null,
    })
    yield* run.send({ id: "m1", text: "hi", images: [] })
    yield* Stream.runDrain(Stream.takeUntil(run.events, (o) => o.type === "provider_session"))
  }).pipe(Effect.scoped)

test("the commands are listed in the working folder with hooks off, asked for once per folder", async () => {
  await withFakeCommands(async (dir, list) => {
    list("review,compact")
    const [first, second] = await Effect.runPromise(
      Effect.all([listCommandsIn(dir), listCommandsIn(dir)]).pipe(Effect.provide(layerClaude)),
    )

    expect(first).toEqual(["review", "compact"])
    expect(second).toEqual(first)
    expect(readFileSync(join(dir, "starts.log"), "utf8")).toBe(
      `${realpathSync(dir)} {"disableAllHooks":true}\n`,
    )
  })
})

test("a run that lists other names makes the next listing ask Claude again", async () => {
  await withFakeCommands(async (dir, list, runLists) => {
    list("review")
    runLists("review,added")
    const names = await Effect.runPromise(
      Effect.gen(function* () {
        const before = yield* listCommandsIn(dir)
        list("review,added")
        yield* runOnce(dir)
        return [before, yield* listCommandsIn(dir)]
      }).pipe(Effect.provide(layerClaude)),
    )

    expect(names).toEqual([["review"], ["review", "added"]])
  })
})

test("a run that lists the same names keeps the listing", async () => {
  await withFakeCommands(async (dir, list, runLists) => {
    list("review")
    runLists("review")
    await Effect.runPromise(
      Effect.gen(function* () {
        yield* listCommandsIn(dir)
        yield* runOnce(dir)
        yield* listCommandsIn(dir)
      }).pipe(Effect.provide(layerClaude)),
    )

    // One start for the listing, one for the run.
    expect(readFileSync(join(dir, "starts.log"), "utf8").trim().split("\n")).toHaveLength(2)
  })
})

test("a Claude Code that exits before answering fails the listing, which asks again next time", async () => {
  await withFakeClaude(
    `require("node:fs").appendFileSync(process.env.FAKE_LOG, "start\\n")`,
    async (dir) => {
      process.env["FAKE_LOG"] = join(dir, "starts.log")
      const errors = await Effect.runPromise(
        Effect.all([Effect.flip(listCommandsIn(dir)), Effect.flip(listCommandsIn(dir))]).pipe(
          Effect.provide(layerClaude),
        ),
      )

      expect(errors.map((error) => error._tag)).toEqual(["HarnessError", "HarnessError"])
      expect(readFileSync(join(dir, "starts.log"), "utf8")).toBe("start\nstart\n")
    },
  )
})
