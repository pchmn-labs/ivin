import { expect, type ElectronApplication, type Page } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { makeTempDir } from "./launch-app.ts"

// `prepare` runs on the empty project folder before the app opens it.
export const startSession = async (
  app: ElectronApplication,
  prepare?: (projectDir: string) => void,
): Promise<Page> => {
  const projectDir = join(makeTempDir("projects"), "my-project")
  mkdirSync(projectDir)
  prepare?.(projectDir)
  const window = await app.firstWindow()
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] })
  }, projectDir)
  await window.getByRole("button", { name: "Open folder…" }).click()
  await expect(window.getByTestId("project-name")).toHaveText("my-project")
  await window.getByRole("complementary").getByRole("button", { name: "New session" }).click()
  return window
}

export const sendMessage = async (window: Page, text: string): Promise<void> => {
  const box = window.getByRole("textbox", { name: "Message" })
  await box.fill(text)
  await box.press("Enter")
}
