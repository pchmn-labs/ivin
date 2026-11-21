import { beforeAll, expect, test } from "vitest"
import { listAnnotations } from "../modules/annotation/usecases/list-annotations.ts"
import { createSession } from "../modules/session/usecases/create-session.ts"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"

beforeAll(buildCli, 60_000)

const url = "https://github.com/o/r/pull/1"

// Each element of `runs` is one call of ivin; "$SESSION" and "$OTHER" stand for the sessions' ids.
const link = (runs: readonly (readonly string[])[], env: Record<string, string> = {}) =>
  withCliServer(async (socketPath, run) => {
    const session = await run(createSession("/p"))
    const other = await run(createSession("/p"))
    const resolve = (value: string) =>
      value.replace("$SESSION", session.id).replace("$OTHER", other.id)
    const results = []
    for (const args of runs) {
      results.push(
        await runCli(
          ["pr", "link", ...args.map(resolve)],
          Object.fromEntries(
            Object.entries({ IVIN_SOCKET: socketPath, IVIN_SESSION_ID: "", ...env }).map(
              ([k, v]) => [k, resolve(v)],
            ),
          ),
        ),
      )
    }
    return {
      results,
      last: results.at(-1)!,
      session: await run(listAnnotations({ _tag: "session", sessionId: session.id }, null)),
      other: await run(listAnnotations({ _tag: "session", sessionId: other.id }, null)),
    }
  })

test("from a session's agent, ivin pr link stores a pr annotation on that session", async () => {
  const run = await link([[url, "--as", "referenced"]], { IVIN_SESSION_ID: "$SESSION" })

  expect(run.last.code).toBe(0)
  expect(run.session).toMatchObject([
    { ns: "cli", kind: "pr", data: { url, relation: "referenced" } },
  ])
  expect(run.other).toEqual([])
}, 10_000)

test("the URL is stored without what follows the pull request's number", async () => {
  const run = await link([[`${url}/files?w=1`, "--as", "created"]], { IVIN_SESSION_ID: "$SESSION" })

  expect(run.last.code).toBe(0)
  expect(run.session).toMatchObject([{ data: { url, relation: "created" } }])
}, 10_000)

test("linking the same pull request again with another relation updates its annotation", async () => {
  const run = await link(
    [
      [url, "--as", "referenced"],
      [`${url}/commits`, "--as", "reviewed"],
    ],
    { IVIN_SESSION_ID: "$SESSION" },
  )

  expect(run.results.map((result) => result.code)).toEqual([0, 0])
  expect(run.session).toMatchObject([{ data: { url, relation: "reviewed" } }])
}, 10_000)

test("--session links the pull request to that session", async () => {
  const run = await link([[url, "--as", "created", "--session", "$OTHER"]], {
    IVIN_SESSION_ID: "$SESSION",
  })

  expect(run.last.code).toBe(0)
  expect(run.other).toHaveLength(1)
  expect(run.session).toEqual([])
}, 10_000)

test("outside an ivin session, --session is required", async () => {
  const run = await link([[url, "--as", "created"]])

  expect(run.last.code).toBe(2)
  expect(run.last.stderr).toContain("--session <id> is required outside an ivin session")
}, 10_000)

test("a URL that is not a pull request says what is expected and exits 2", async () => {
  const env = { IVIN_SESSION_ID: "$SESSION" }
  const issue = await link([["https://github.com/o/r/issues/1", "--as", "created"]], env)
  const none = await link([["--as", "created"]], env)

  expect(issue.last.code).toBe(2)
  expect(issue.last.stderr).toContain(
    "is not the URL of a GitHub pull request or a GitLab merge request",
  )
  expect(issue.last.stderr).toContain("/-/merge_requests/<number>")
  expect(none.last.code).toBe(2)
  expect(none.last.stderr).toContain("ivin pr link needs a pull request URL")
  expect([...issue.session, ...none.session]).toEqual([])
}, 10_000)

test("a relation outside created, referenced and reviewed says what is expected and exits 2", async () => {
  const env = { IVIN_SESSION_ID: "$SESSION" }
  const wrong = await link([[url, "--as", "resolved"]], env)
  const missing = await link([[url]], env)

  expect(wrong.last.code).toBe(2)
  expect(wrong.last.stderr).toContain("--as must be created, referenced or reviewed")
  expect(missing.last.code).toBe(2)
  expect(missing.last.stderr).toContain("--as must be created, referenced or reviewed")
  expect([...wrong.session, ...missing.session]).toEqual([])
}, 10_000)

test("an unknown session exits 1 and names it", async () => {
  const run = await link([[url, "--as", "created", "--session", "nope"]])

  expect(run.last.code).toBe(1)
  expect(run.last.stderr).toContain('No session has the id "nope"')
}, 10_000)

test("--json prints the stored annotation", async () => {
  const run = await link([[url, "--as", "created", "--json"]], { IVIN_SESSION_ID: "$SESSION" })

  expect(run.last.code).toBe(0)
  const output = JSON.parse(run.last.stdout) as { ok: boolean; annotation: Record<string, unknown> }
  expect(output).toMatchObject({
    ok: true,
    annotation: { id: run.session[0]!.id, kind: "pr", data: { url, relation: "created" } },
  })
}, 10_000)
