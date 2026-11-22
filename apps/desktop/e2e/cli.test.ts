import { expect, test } from "@playwright/test"
import { execFile } from "node:child_process"
import { lstatSync, mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { claudeConfigDir, launchPackagedApp, makeFakeClaudeBin, makeTempDir } from "./launch-app.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

const runIvin = (userDataDir: string, args: string[]) =>
  new Promise<{ code: number; output: string }>((resolve) => {
    execFile(
      join(userDataDir, "bin", "ivin"),
      args,
      { env: { ...process.env, IVIN_SOCKET: join(userDataDir, ".ivin/run/ivin.sock") } },
      (error, stdout, stderr) =>
        resolve({ code: error ? Number(error.code) : 0, output: stdout + stderr }),
    )
  })

test("a session's agent runs ivin doctor, which passes every check", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), {
    fakeClaudeBin: makeFakeClaudeBin(),
  })
  try {
    const window = await startSession(app)
    await sendMessage(window, "run: ivin doctor; echo exit=$?")

    const answer = window.getByTestId("transcript-item").filter({ hasText: /exit=\d/ })
    await expect(answer).toContainText("✓ ivin 0.0.0 is running")
    await expect(answer).toContainText("settings.json is valid or absent")
    await expect(answer).toContainText("claude found at")
    await expect(answer).toContainText("exit=0")
  } finally {
    await app.close()
  }
})

test("the socket is its owner's only, replaces a stale one, and is gone once the app quits", async () => {
  const userDataDir = makeTempDir("user-data")
  const socketPath = join(userDataDir, ".ivin/run/ivin.sock")
  mkdirSync(join(userDataDir, ".ivin/run"), { recursive: true })
  writeFileSync(socketPath, "left by a crash")

  const app = await launchPackagedApp(userDataDir)
  try {
    const window = await app.firstWindow()
    await expect(window.getByTestId("server-version")).toHaveText("Server 0.0.0")
    await expect.poll(() => lstatSync(socketPath).isSocket()).toBe(true)
    expect(lstatSync(socketPath).mode & 0o777).toBe(0o600)

    expect(await runIvin(userDataDir, ["doctor"])).toMatchObject({ code: 0 })
  } finally {
    await app.close()
  }

  expect(existsSync(socketPath)).toBe(false)
  const closed = await runIvin(userDataDir, ["doctor"])
  expect(closed.code).toBe(3)
  expect(closed.output).toContain("ivin is not running")
})

const skillFolderOf = (userDataDir: string) =>
  join(claudeConfigDir(userDataDir), "skills/ivin-customize")

test("the first launch installs the ivin-customize skill into Claude, and the next one replaces an older one", async () => {
  const userDataDir = makeTempDir("user-data")
  const skillFolder = skillFolderOf(userDataDir)
  const fakeClaudeBin = makeFakeClaudeBin()

  let app = await launchPackagedApp(userDataDir, { fakeClaudeBin })
  try {
    await app.firstWindow()
    await expect.poll(() => existsSync(join(skillFolder, "SKILL.md"))).toBe(true)
    expect(readFileSync(join(skillFolder, "SKILL.md"), "utf8")).toContain("name: ivin-customize")
    const doctor = await runIvin(userDataDir, ["doctor"])
    expect(doctor.output).toContain(`✓ Installed the ivin-customize skill at ${skillFolder}`)
  } finally {
    await app.close()
  }

  writeFileSync(join(skillFolder, "SKILL.md"), "an older skill")
  writeFileSync(join(skillFolder, ".installed-by-ivin"), "older\n")
  app = await launchPackagedApp(userDataDir, { fakeClaudeBin })
  try {
    await app.firstWindow()
    await expect
      .poll(() => readFileSync(join(skillFolder, "SKILL.md"), "utf8"))
      .toContain("name: ivin-customize")
    expect((await runIvin(userDataDir, ["doctor"])).output).toContain(
      `✓ Updated the ivin-customize skill at ${skillFolder}`,
    )
  } finally {
    await app.close()
  }
})

test("a launch leaves an ivin-customize skill the user made as it is, and ivin doctor says so", async () => {
  const userDataDir = makeTempDir("user-data")
  const skillFolder = skillFolderOf(userDataDir)
  mkdirSync(skillFolder, { recursive: true })
  writeFileSync(join(skillFolder, "SKILL.md"), "my own skill")

  const app = await launchPackagedApp(userDataDir, { fakeClaudeBin: makeFakeClaudeBin() })
  try {
    await app.firstWindow()
    await expect.poll(() => existsSync(join(userDataDir, ".ivin/run/ivin.sock"))).toBe(true)
    const doctor = await runIvin(userDataDir, ["doctor"])

    expect(doctor.output).toContain(`✓ ${skillFolder} is not ivin's: ivin left it as it is.`)
    expect(readFileSync(join(skillFolder, "SKILL.md"), "utf8")).toBe("my own skill")
    expect(existsSync(join(skillFolder, ".installed-by-ivin"))).toBe(false)
  } finally {
    await app.close()
  }
})
