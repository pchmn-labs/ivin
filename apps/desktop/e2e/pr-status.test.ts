import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeFakeGhBin, makeTempDir } from "./launch-app.ts"
import { sendMessage } from "./session-helpers.ts"

test("a pull request the agent opens with gh shows its status on the session's tab and row, and in the card a hover opens", async () => {
  const app = await launchPackagedApp(makeTempDir("user-data"), {
    harness: "scripted-pr",
    prependPath: makeFakeGhBin(),
  })
  try {
    const project = join(makeTempDir("projects"), "widgets")
    mkdirSync(project)
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [folder] })
    }, project)
    const window = await app.firstWindow()
    await window.getByRole("button", { name: "Open folder…" }).click()
    await window.getByRole("dialog").getByRole("button", { name: "Trust and open" }).click()
    await window.getByRole("complementary").getByRole("button", { name: "New session" }).click()
    await sendMessage(window, "Open a pull request for the widget")

    const tab = window.getByTestId("tab")
    const tile = tab.getByRole("img", { name: /^Pull request, open, ready to merge$/ })
    await expect(tile).toBeVisible({ timeout: 30_000 })
    await expect(
      window
        .getByTestId("session-item")
        .getByRole("img", { name: /^Pull request, open, ready to merge$/ }),
    ).toBeVisible()

    await tab.hover()
    const link = window.getByRole("link", { name: /Add the widget/ })
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", "https://github.com/acme/widgets/pull/7")
    await expect(window.getByText("Ready to merge")).toBeVisible()
  } finally {
    await app.close()
  }
})
