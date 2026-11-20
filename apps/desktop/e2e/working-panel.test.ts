import { expect, test, type ElectronApplication } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { sendMessage } from "./session-helpers.ts"

const openProject = async (app: ElectronApplication, name: string) => {
  const path = join(makeTempDir("projects"), name)
  mkdirSync(path)
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [folder] })
  }, path)
  const window = await app.firstWindow()
  await window.getByRole("button", { name: "Open folder…" }).click()
  await expect(window.getByTestId("project-name")).toHaveText(name)
}

test("a session waiting for an approval in another project shows in the Working panel with its command, and a click opens it ready for Enter", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), { harness: "scripted-approval" })
  try {
    const window = await app.firstWindow()
    const sidebar = window.getByRole("complementary")
    await openProject(app, "shop")
    await sidebar.getByRole("button", { name: "New session" }).click()
    await sendMessage(window, "Run the tests")
    const tab = window.getByTestId("tab")
    await expect(tab.getByText("Idle")).toBeAttached()
    await sendMessage(window, "Again")
    await expect(tab.getByText("Waiting for you")).toBeAttached()

    await openProject(app, "blog")
    const panel = sidebar.getByTestId("working-panel")
    const row = panel.getByRole("region", { name: "Needs you" }).getByTestId("working-session")
    await expect(row).toContainText("Run the tests")
    await expect(row).toContainText("shop")
    await expect(row).toContainText("pnpm test")

    await row.getByRole("button", { name: /^Waiting for you Run the tests/ }).click()

    await expect(window.getByTestId("project-name")).toHaveText("shop")
    await expect(window.getByRole("tab", { selected: true })).toContainText("Run the tests")
    await expect(panel).toHaveCount(0)
    await expect(window.getByRole("radio", { name: "Allow" })).toBeFocused()
    await window.keyboard.press("Enter")
    await expect(window.getByTestId("approval-sheet")).toHaveCount(0)
  } finally {
    await app.close()
  }
})

test("Allow on a Working panel row answers the approval of another project's session without opening it", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), { harness: "scripted-approval" })
  try {
    const window = await app.firstWindow()
    const sidebar = window.getByRole("complementary")
    await openProject(app, "shop")
    await sidebar.getByRole("button", { name: "New session" }).click()
    await sendMessage(window, "Run the tests")
    const tab = window.getByTestId("tab")
    await expect(tab.getByText("Idle")).toBeAttached()
    await sendMessage(window, "Again")
    await expect(tab.getByText("Waiting for you")).toBeAttached()

    await openProject(app, "blog")
    await sidebar.getByRole("button", { name: "Allow: Run the tests" }).click()

    await expect(sidebar.getByTestId("working-panel")).toHaveCount(0)
    await expect(window.getByTestId("project-name")).toHaveText("blog")
  } finally {
    await app.close()
  }
})
