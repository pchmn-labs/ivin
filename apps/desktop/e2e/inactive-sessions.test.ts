import { expect, test } from "@playwright/test"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

test("a session whose tab is closed is listed under Inactive sessions, and clicking it opens its tab again", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  try {
    const window = await startSession(app)
    await sendMessage(window, "Fix the login")
    const tab = window.getByTestId("tab")
    await expect(tab.getByTestId("tab-title")).toHaveText("Fix the login")
    await expect(tab.getByText("Idle")).toBeAttached()

    await tab.hover()
    await window.getByRole("button", { name: "Close Fix the login" }).click()
    await expect(window.getByRole("tab")).toHaveCount(0)

    const sidebar = window.getByRole("complementary")
    await sidebar.getByText(/^Inactive sessions/).click()
    await sidebar.getByTestId("inactive-session").getByText("Fix the login").click()

    await expect(window.getByRole("tab")).toHaveCount(1)
    await expect(sidebar.getByText(/^Inactive sessions/)).toHaveCount(0)
  } finally {
    await app.close()
  }
})
