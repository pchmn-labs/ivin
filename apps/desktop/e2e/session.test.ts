import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"

const scriptedAnswer = "The scripted answer: this project has 3 files and every test passes."

test("a message sent in a new session gets the scripted answer, and both are back after a relaunch", async () => {
  const userDataDir = makeTempDir("user-data")
  const projectDir = join(makeTempDir("projects"), "my-project")
  mkdirSync(projectDir)

  const first = await launchPackagedApp(userDataDir)
  try {
    const window = await first.firstWindow()
    await first.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] })
    }, projectDir)
    await window.getByRole("button", { name: "Open folder…" }).click()
    await expect(window.getByTestId("project-name")).toHaveText("my-project")

    await window.getByRole("button", { name: "New session" }).click()
    await window.getByRole("textbox", { name: "Message" }).fill("How many files are there?")
    await window.getByRole("textbox", { name: "Message" }).press("Enter")

    const items = window.getByTestId("transcript-item")
    await expect(items.filter({ hasText: "How many files are there?" })).toHaveCount(1)
    await expect(items.filter({ hasText: scriptedAnswer })).toHaveCount(1)
  } finally {
    await first.close()
  }

  const second = await launchPackagedApp(userDataDir)
  try {
    const window = await second.firstWindow()
    await window.getByText("How many files are there?").first().click()

    const items = window.getByTestId("transcript-item")
    await expect(items.filter({ hasText: "How many files are there?" })).toHaveCount(1)
    await expect(items.filter({ hasText: scriptedAnswer })).toHaveCount(1)
  } finally {
    await second.close()
  }
})
