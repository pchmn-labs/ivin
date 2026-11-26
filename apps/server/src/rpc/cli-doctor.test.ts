import { beforeAll, expect, test, vi } from "vitest"
import { buildCli, runCli, tempSocketPath, withCliServer } from "./cli-server.ts"

vi.setConfig({ testTimeout: 10_000 })

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
    "✓ The scripted harness takes no skills",
  ])
})

test.each([
  ["installed", "✓ Installed the ivin-customize skill at /home/.claude/skills/ivin-customize"],
  ["updated", "✓ Updated the ivin-customize skill at /home/.claude/skills/ivin-customize"],
  ["upToDate", "✓ The ivin-customize skill at /home/.claude/skills/ivin-customize is up to date"],
  [
    "notOurs",
    "✓ /home/.claude/skills/ivin-customize is not ivin's: ivin left it as it is. Remove it to get ivin's ivin-customize skill at the next launch",
  ],
] as const)("ivin doctor reports a skill install that %s", async (status, line) => {
  const run = await withCliServer((socketPath) => runCli(["doctor"], { IVIN_SOCKET: socketPath }), {
    skills: [{ name: "ivin-customize", path: "/home/.claude/skills/ivin-customize", status }],
  })

  expect(run.code).toBe(0)
  expect(run.stdout.trim().split("\n").at(-1)).toBe(line)
})

test("ivin doctor reports a failed skill install and exits 1", async () => {
  const run = await withCliServer((socketPath) => runCli(["doctor"], { IVIN_SOCKET: socketPath }), {
    skills: [
      { name: "ivin-customize", path: "/home/.claude/skills/ivin-customize", status: "failed" },
    ],
  })

  expect(run.code).toBe(1)
  expect(run.stdout).toContain(
    "✗ Could not install the ivin-customize skill at /home/.claude/skills/ivin-customize; the error is in ~/.ivin/logs/ivin.log",
  )
})

test("ivin doctor reports the install of each skill, one line each", async () => {
  const run = await withCliServer((socketPath) => runCli(["doctor"], { IVIN_SOCKET: socketPath }), {
    skills: [
      { name: "ivin-customize", path: "/home/.claude/skills/ivin-customize", status: "upToDate" },
      { name: "ivin-plugin", path: "/home/.claude/skills/ivin-plugin", status: "installed" },
    ],
  })

  expect(run.stdout.trim().split("\n").slice(-2)).toEqual([
    "✓ The ivin-customize skill at /home/.claude/skills/ivin-customize is up to date",
    "✓ Installed the ivin-plugin skill at /home/.claude/skills/ivin-plugin",
  ])
})

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
})

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
})

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
})

test("an agent whose app serves no socket is told so instead of reaching another ivin", async () => {
  const run = await runCli(["doctor"], { IVIN_SOCKET: "" })

  expect(run.code).toBe(3)
  expect(run.stderr).toContain("The ivin that started this agent serves no socket")
})

test("ivin --help, ivin doctor --help and its -h print their usage", async () => {
  const main = await runCli(["--help"])
  const doctor = await runCli(["doctor", "--help"])

  expect(main.code).toBe(0)
  expect(main.stdout).toContain("Usage: ivin <command> [options]")
  expect(doctor.code).toBe(0)
  expect(doctor.stdout).toContain("Usage: ivin doctor [--json]")
  expect((await runCli(["doctor", "-h"])).stdout).toBe(doctor.stdout)
})

test.each([[["frob"]], [["doctor", "--frob"]], [["doctor", "extra"]], [[]]])(
  "invalid usage %j exits 2 with a message",
  async (args) => {
    const run = await runCli(args)

    expect(run.code).toBe(2)
    expect(run.stderr).toContain("Usage: ivin")
  },
)
