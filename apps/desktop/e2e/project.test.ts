import { expect, test } from "@playwright/test"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"

test("a picked folder is shown by name, reopened after a relaunch, and stored in the user data folder", async () => {
  const userDataDir = makeTempDir("user-data")
  const projectDir = join(makeTempDir("projects"), "my-project")
  mkdirSync(projectDir)

  const first = await launchPackagedApp(userDataDir)
  try {
    const window = await first.firstWindow()
    await expect(window.getByTestId("project-name")).toHaveCount(0)
    await expect(window.getByText("No project open")).toBeVisible()

    await first.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] })
    }, projectDir)
    await window.getByRole("button", { name: "Open folder…" }).click()
    await expect(window.getByTestId("project-name")).toHaveText("my-project")
  } finally {
    await first.close()
  }

  expect(existsSync(join(userDataDir, "ivin.db"))).toBe(true)

  const second = await launchPackagedApp(userDataDir)
  try {
    const window = await second.firstWindow()
    await expect(window.getByTestId("project-name")).toHaveText("my-project")
  } finally {
    await second.close()
  }
})
