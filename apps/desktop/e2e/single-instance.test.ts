import { expect, test } from "@playwright/test"
import { spawn } from "node:child_process"
import { launchPackagedApp, makeTempDir, packagedLaunch } from "./launch-app.ts"

test("opening ivin again on the same data folder brings the open window to the front and quits the second copy", async () => {
  const userDataDir = makeTempDir("user-data")
  const first = await launchPackagedApp(userDataDir, { background: false })
  try {
    const window = await first.firstWindow()
    await expect(window.getByRole("button", { name: "Open folder…" })).toBeVisible()
    await first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.hide())
    expect(
      await first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible()),
    ).toBe(false)

    const { executablePath, args, env } = packagedLaunch(userDataDir, { background: false })
    const second = spawn(executablePath, args, { env, stdio: "ignore" })
    const code = await new Promise((resolve) => second.once("exit", resolve))

    expect(code).toBe(0)
    await expect
      .poll(() =>
        first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.isVisible()),
      )
      .toBe(true)
    expect(await first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(
      1,
    )
  } finally {
    await first.close()
  }
})
