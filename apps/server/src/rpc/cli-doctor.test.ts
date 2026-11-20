import { beforeAll, expect, test } from "vitest"
import { buildCli, runCli, tempSocketPath, withCliServer } from "./cli-server.ts"

beforeAll(buildCli, 60_000)

test("ivin doctor prints one passing line per check and exits 0 with a healthy app", async () => {
  const run = await withCliServer((socketPath) =>
    runCli(["doctor"], { IVIN_SOCKET: socketPath }).then((run) => ({ run, socketPath })),
  )

  expect(run.run.code).toBe(0)
  expect(run.run.stdout.trim().split("\n")).toEqual([
    "✓ ivin 1.2.3 is running",
    `✓ Answering on ${run.socketPath}`,
    "✓ /home/.ivin/settings.json is valid or absent",
    "✓ /home/.ivin/keybindings.json is valid or absent",
    "✓ The scripted harness runs no program",
  ])
}, 10_000)

test("ivin doctor names a broken settings.json and keybindings.json, and exits 1", async () => {
  const run = await withCliServer((socketPath) => runCli(["doctor"], { IVIN_SOCKET: socketPath }), {
    settings: `{ "tabs": { "stopAgentOnClose": "yes" } }`,
    keybindings: "[{",
  })

  expect(run.code).toBe(1)
  expect(run.stdout).toContain(
    `✗ /home/.ivin/settings.json has an invalid value for "tabs.stopAgentOnClose"`,
  )
  expect(run.stdout).toContain("✗ /home/.ivin/keybindings.json is not valid JSON")
}, 10_000)

test("ivin doctor --json prints the checks as JSON", async () => {
  const run = await withCliServer(
    (socketPath) => runCli(["doctor", "--json"], { IVIN_SOCKET: socketPath }),
    { keybindings: "{}" },
  )

  expect(run.code).toBe(1)
  const output = JSON.parse(run.stdout) as { ok: boolean; checks: unknown[] }
  expect(output.ok).toBe(false)
  expect(output.checks).toContainEqual({
    check: "keybindings",
    ok: false,
    message:
      "/home/.ivin/keybindings.json does not hold a list; ivin uses the last valid keybindings until it is fixed",
  })
}, 10_000)

test("with the app closed, ivin says it is not running and exits 3", async () => {
  const socketPath = tempSocketPath()
  const text = await runCli(["doctor"], { IVIN_SOCKET: socketPath })
  const json = await runCli(["doctor", "--json"], { IVIN_SOCKET: socketPath })

  expect(text.code).toBe(3)
  expect(text.stderr).toBe(
    `ivin is not running: nothing answers on ${socketPath}. Open the ivin app, then run the command again.\n`,
  )
  expect(json.code).toBe(3)
  expect(JSON.parse(json.stdout)).toMatchObject({ ok: false, error: { reason: "notRunning" } })
}, 10_000)

test("ivin --help and ivin doctor --help describe the commands and their options", async () => {
  const main = await runCli(["--help"])
  const doctor = await runCli(["doctor", "--help"])

  expect(main.code).toBe(0)
  expect(main.stdout).toContain("Usage: ivin <command> [options]")
  expect(main.stdout).toMatch(/doctor +Check that ivin/)
  expect(doctor.code).toBe(0)
  expect(doctor.stdout).toContain("Usage: ivin doctor [--json]")
  expect(doctor.stdout).toMatch(/--json +Print the result as JSON/)
}, 10_000)

test.each([[["frob"]], [["doctor", "--frob"]], [["doctor", "extra"]], [[]]])(
  "invalid usage %j exits 2 with a message",
  async (args) => {
    const run = await runCli(args)

    expect(run.code).toBe(2)
    expect(run.stderr).toContain("Usage: ivin")
  },
  10_000,
)
