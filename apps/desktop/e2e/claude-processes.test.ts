import { expect, test } from "@playwright/test"
import {
  fakeClaudeCommand,
  launchPackagedApp,
  makeFakeClaudeBin,
  makeTempDir,
} from "./launch-app.ts"
import { descendantsOf, isAlive } from "./processes.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

test("quitting the app stops the claude process it started", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), {
    fakeClaudeBin: makeFakeClaudeBin(),
  })
  const appProcess = app.process()
  try {
    const window = await startSession(app)
    await sendMessage(window, "Hello")
    await expect(
      window.getByTestId("transcript-item").filter({ hasText: "echo: Hello" }),
    ).toHaveCount(1)

    const claudes = () =>
      descendantsOf(appProcess.pid!).filter((proc) => proc.command.includes(fakeClaudeCommand))
    await expect.poll(() => claudes().length).toBeGreaterThan(0)
    const started = claudes()

    const exited = new Promise((resolve) => appProcess.once("exit", resolve))
    await app.evaluate(({ app }) => app.quit())
    await exited

    await expect.poll(() => started.filter((proc) => isAlive(proc.pid))).toEqual([])
  } finally {
    appProcess.kill()
  }
})
