import { expect, test } from "@playwright/test"
import { launchPackagedApp, makeFakeClaudeBin, makeTempDir } from "./launch-app.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

test("Escape stops a running session, and a message sent while it runs reaches the agent", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), {
    fakeClaudeBin: makeFakeClaudeBin(),
  })
  try {
    const window = await startSession(app)
    const items = window.getByTestId("transcript-item")
    const status = window.getByTestId("composer-session-status")

    await sendMessage(window, "First")
    await expect(status).toHaveText("Working")
    await expect(items.filter({ hasText: "echo: First" })).toHaveCount(1)

    await sendMessage(window, "Second")
    await expect(items.filter({ hasText: "echo: Second" })).toHaveCount(1)

    await window.getByRole("textbox", { name: "Message" }).press("Escape")
    await expect(items.filter({ hasText: "Interrupted" })).toHaveCount(1)
    await expect(status).toHaveText("Idle")
  } finally {
    await app.close()
  }
})
