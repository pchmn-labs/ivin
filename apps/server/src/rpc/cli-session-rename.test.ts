import { beforeAll, expect, test } from "vitest"
import { createSession } from "../modules/session/usecases/create-session.ts"
import { listSessions } from "../modules/session/usecases/list-sessions.ts"
import { renameSession } from "../modules/session/usecases/rename-session.ts"
import { buildCli, runCli, withCliServer } from "./cli-server.ts"

beforeAll(buildCli, 60_000)

// The tests may themselves run in an ivin session's agent, hence the empty IVIN_SESSION_ID.
const rename = (
  args: readonly string[],
  options: { inSession?: boolean; userTitle?: string } = {},
) =>
  withCliServer(async (socketPath, run) => {
    const session = await run(createSession("/p"))
    if (options.userTitle !== undefined) await run(renameSession(session.id, options.userTitle))
    const result = await runCli(["session", "rename", ...args], {
      IVIN_SOCKET: socketPath,
      IVIN_SESSION_ID: options.inSession === false ? "" : session.id,
    })
    const [stored] = await run(listSessions("/p"))
    return { ...result, title: stored!.title }
  })

test("from a session's agent, ivin session rename sets that session's title", async () => {
  const run = await rename(["  Fix tab drag  "])

  expect(run.code).toBe(0)
  expect(run.title).toBe("Fix tab drag")
}, 10_000)

test("a title the user gave stays, and the command says so and exits 1", async () => {
  const run = await rename(["Fix tab drag"], { userTitle: "Mine" })

  expect(run.code).toBe(1)
  expect(run.stderr).toContain("The user named this session")
  expect(run.title).toBe("Mine")
}, 10_000)

test("an empty or missing title exits 2", async () => {
  const blank = await rename(["  "])
  const missing = await rename([])

  expect(blank.code).toBe(2)
  expect(blank.stderr).toContain("ivin session rename needs a title")
  expect(missing.code).toBe(2)
  expect(blank.title).toBe("New session")
}, 10_000)

test("outside an ivin session, --session is required", async () => {
  const run = await rename(["Fix tab drag"], { inSession: false })

  expect(run.code).toBe(2)
  expect(run.stderr).toContain("--session <id> is required outside an ivin session")
}, 10_000)

test("an unknown session exits 1 and names it", async () => {
  const run = await rename(["Fix tab drag", "--session", "nope"])

  expect(run.code).toBe(1)
  expect(run.stderr).toContain('No session has the id "nope"')
}, 10_000)

test("--json prints the session's new title", async () => {
  const run = await rename(["Fix tab drag", "--json"])

  expect(JSON.parse(run.stdout)).toMatchObject({ ok: true, title: "Fix tab drag" })
}, 10_000)
