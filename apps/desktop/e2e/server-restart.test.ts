import { expect, test } from "@playwright/test"
import { readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { descendantsOf } from "./processes.ts"
import { startSession } from "./session-helpers.ts"

const restartingMessage = "ivin's server stopped. Restarting it…"

test("a server that is killed restarts, and the window keeps the composer's draft", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  try {
    const window = await startSession(app)
    const box = window.getByRole("textbox", { name: "Message" })
    await box.fill("a draft the restart must keep")
    // The message lasts as long as the restart: record that it showed instead of racing it.
    await window.evaluate((message) => {
      const seen = { restarting: false }
      Object.assign(window, { serverMessageSeen: seen })
      new MutationObserver(() => {
        if (document.body.textContent?.includes(message)) seen.restarting = true
      }).observe(document.body, { childList: true, subtree: true, characterData: true })
    }, restartingMessage)

    const [server] = descendantsOf(app.process().pid!).filter((proc) =>
      proc.command.includes("node.mojom.NodeService"),
    )
    process.kill(server!.pid, "SIGKILL")

    await expect
      .poll(() =>
        window.evaluate(
          () =>
            (window as unknown as { serverMessageSeen: { restarting: boolean } }).serverMessageSeen
              .restarting,
        ),
      )
      .toBe(true)
    await expect(window.getByRole("alert")).toHaveCount(0)
    await expect(box).toHaveText("a draft the restart must keep")

    await box.press("Enter")
    await expect(
      window.getByTestId("transcript-item").filter({ hasText: "a draft the restart must keep" }),
    ).toHaveCount(1)
  } finally {
    await app.close()
  }
})

test("a server that cannot start shows that it keeps stopping, and Restart tries again", async () => {
  const userDataDir = makeTempDir("user-data")
  const database = join(userDataDir, "ivin.db")
  writeFileSync(database, "this is not a database\n".repeat(400))
  const app = await launchPackagedApp(userDataDir)
  try {
    const window = await app.firstWindow()
    const logPath = join(userDataDir, ".ivin", "logs", "ivin.log")
    const alert = window.getByRole("alert")
    await expect(alert).toContainText(`ivin's server keeps stopping. Its log is at ${logPath}.`)
    expect(readFileSync(logPath, "utf8")).not.toBe("")

    rmSync(database)
    await alert.getByRole("button", { name: "Restart" }).click()

    await expect(window.getByRole("button", { name: "Open folder…" })).toBeVisible()
    await expect(window.getByRole("alert")).toHaveCount(0)
  } finally {
    await app.close()
  }
})
