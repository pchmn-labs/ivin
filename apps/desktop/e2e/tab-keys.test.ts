import { expect, test } from "@playwright/test"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

test("mod+W closes the selected session tab and leaves the window open", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  try {
    const window = await startSession(app)
    await sendMessage(window, "Fix the login")
    const tabs = window.getByRole("tablist", { name: "Open sessions" }).getByRole("tab")
    await expect(tabs).toHaveCount(1)
    await expect(window.getByTestId("tab").getByText("Idle")).toBeAttached()

    await window.keyboard.press(process.platform === "darwin" ? "Meta+W" : "Control+W")
    await expect(tabs).toHaveCount(0)
    expect(app.windows()).toHaveLength(1)
    await expect(window.getByRole("button", { name: "New session" }).first()).toBeVisible()
  } finally {
    await app.close()
  }
})
