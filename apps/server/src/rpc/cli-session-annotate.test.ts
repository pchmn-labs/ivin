import { beforeAll, expect, test } from "vitest"
import { listAnnotations } from "../modules/annotation/usecases/list-annotations.ts"
import { createSession } from "../modules/session/usecases/create-session.ts"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"

beforeAll(buildCli, 60_000)

// The tests may themselves run in an ivin session's agent.
const outsideSession = { IVIN_SESSION_ID: "" }

const annotate = (args: readonly string[], env: Record<string, string> = {}) =>
  withCliServer(async (socketPath, run) => {
    const session = await run(createSession("/p"))
    const other = await run(createSession("/p"))
    const resolve = (value: string) =>
      value.replace("$SESSION", session.id).replace("$OTHER", other.id)
    const result = await runCli(
      ["session", "annotate", ...args.map(resolve)],
      Object.fromEntries(
        Object.entries({ IVIN_SOCKET: socketPath, ...outsideSession, ...env }).map(([k, v]) => [
          k,
          resolve(v),
        ]),
      ),
    )
    return {
      ...result,
      session: await run(listAnnotations({ _tag: "session", sessionId: session.id }, null)),
      other: await run(listAnnotations({ _tag: "session", sessionId: other.id }, null)),
    }
  })

test("from a session's agent, ivin session annotate stores the annotation on that session", async () => {
  const run = await annotate(["--kind", "note", "--data", '{"text":"hi"}'], {
    IVIN_SESSION_ID: "$SESSION",
  })

  expect(run.code).toBe(0)
  expect(run.session).toMatchObject([{ ns: "cli", kind: "note", data: { text: "hi" } }])
  expect(run.other).toEqual([])
}, 10_000)

test("--session annotates that session, over the agent's own, and --ns sets the namespace", async () => {
  const run = await annotate(
    ["--kind", "note", "--data", '"hi"', "--session", "$OTHER", "--ns", "mine"],
    { IVIN_SESSION_ID: "$SESSION" },
  )

  expect(run.code).toBe(0)
  expect(run.other).toMatchObject([{ ns: "mine", kind: "note", data: "hi" }])
  expect(run.session).toEqual([])
}, 10_000)

test("outside an ivin session, --session is required", async () => {
  const without = await annotate(["--kind", "note", "--data", "1"])
  const withSession = await annotate(["--kind", "note", "--data", "1", "--session", "$SESSION"])

  expect(without.code).toBe(2)
  expect(without.stderr).toContain("--session <id> is required outside an ivin session")
  expect(withSession.code).toBe(0)
  expect(withSession.session).toHaveLength(1)
}, 10_000)

test("invalid JSON in --data, or a missing --kind, says what is wrong and exits 2", async () => {
  const badJson = await annotate(["--kind", "note", "--data", "{text"], {
    IVIN_SESSION_ID: "$SESSION",
  })
  const noKind = await annotate(["--data", "1"], { IVIN_SESSION_ID: "$SESSION" })

  expect(badJson.code).toBe(2)
  expect(badJson.stderr).toContain("--data is not valid JSON")
  expect(noKind.code).toBe(2)
  expect(noKind.stderr).toContain("--kind <kind> is required")
  expect([...badJson.session, ...noKind.session]).toEqual([])
}, 10_000)

test("an empty --session or --ns exits 2 rather than falling back to the default", async () => {
  const env = { IVIN_SESSION_ID: "$SESSION" }
  const noSession = await annotate(["--kind", "note", "--data", "1", "--session", ""], env)
  const noNs = await annotate(["--kind", "note", "--data", "1", "--ns", ""], env)

  expect(noSession.code).toBe(2)
  expect(noSession.stderr).toContain("--session needs a session id")
  expect(noNs.code).toBe(2)
  expect([...noSession.session, ...noNs.session]).toEqual([])
}, 10_000)

test("data that does not match a defined kind exits 2", async () => {
  const run = await annotate(["--kind", "pr", "--data", '{"text":"hi"}'], {
    IVIN_SESSION_ID: "$SESSION",
  })

  expect(run.code).toBe(2)
  expect(run.stderr).toContain("does not have the shape of a pr annotation")
}, 10_000)

test("an unknown session exits 1 and names it", async () => {
  const run = await annotate(["--kind", "note", "--data", "1", "--session", "nope"])

  expect(run.code).toBe(1)
  expect(run.stderr).toContain('No session has the id "nope"')
}, 10_000)

test("--json prints the stored annotation", async () => {
  const run = await annotate(["--kind", "note", "--data", '{"text":"hi"}', "--json"], {
    IVIN_SESSION_ID: "$SESSION",
  })

  expect(run.code).toBe(0)
  const output = JSON.parse(run.stdout) as { ok: boolean; annotation: Record<string, unknown> }
  expect(output.ok).toBe(true)
  expect(output.annotation).toMatchObject({
    id: run.session[0]!.id,
    target: run.session[0]!.target,
    ns: "cli",
    kind: "note",
    data: { text: "hi" },
    createdAt: expect.any(Number),
  })
}, 10_000)
