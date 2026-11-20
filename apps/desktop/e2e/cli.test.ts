import { expect, test } from "@playwright/test"
import { execFile } from "node:child_process"
import { lstatSync, mkdirSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeFakeClaudeBin, makeTempDir } from "./launch-app.ts"
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
