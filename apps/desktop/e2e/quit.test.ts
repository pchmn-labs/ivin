import { expect, test } from "@playwright/test"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { descendantsOf, isAlive } from "./processes.ts"

test("quitting the app leaves no server process running", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  // app.process() throws once Playwright has disposed the app, shortly after it exits.
  const appProcess = app.process()
  try {
    const appPid = appProcess.pid!
    const window = await app.firstWindow()
    await expect(window.getByTestId("server-version")).toHaveText("Server 0.0.0")

    const children = descendantsOf(appPid)
    const servers = children.filter((proc) => proc.command.includes("node.mojom.NodeService"))
    expect(servers.length).toBeGreaterThan(0)

    const exited = new Promise((resolve) => appProcess.once("exit", resolve))
    await app.evaluate(({ app }) => app.quit())
    await exited

    await expect.poll(() => children.filter((proc) => isAlive(proc.pid))).toEqual([])
  } finally {
    appProcess.kill()
  }
})
