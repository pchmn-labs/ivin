import { expect, test } from "@playwright/test"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { sendMessage, startSession } from "./session-helpers.ts"

test("mod+W closes the selected session tab and leaves the window open, and the menu keeps its Edit items and Quit", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"))
  try {
    const window = await startSession(app)
    await sendMessage(window, "Fix the login")
    const tabs = window.getByRole("tablist", { name: "Open sessions" }).getByRole("tab")
    await expect(tabs).toHaveCount(1)
    await expect(window.getByTestId("tab").getByText("Idle")).toBeAttached()

    const roles = await app.evaluate(({ Menu }) => {
      const walk = (items: Electron.MenuItem[]): string[] =>
        items.flatMap((item) => [item.role ?? "", ...walk(item.submenu?.items ?? [])])
      return walk(Menu.getApplicationMenu()?.items ?? []).map((role) => role.toLowerCase())
    })
    expect(roles).not.toContain("close")
    expect(roles).toEqual(
      expect.arrayContaining(["undo", "redo", "cut", "copy", "paste", "selectall", "quit"]),
    )

    await window.keyboard.press(process.platform === "darwin" ? "Meta+W" : "Control+W")
    await expect(tabs).toHaveCount(0)
    expect(app.windows()).toHaveLength(1)
    await expect(window.getByRole("button", { name: "New session" }).first()).toBeVisible()
  } finally {
    await app.close()
  }
})
