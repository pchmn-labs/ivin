import { demoAnswer as scriptedAnswer, demoUsage } from "@ivin/harness"
import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"

const usageTotals = (turns: number) => ({
  tokens: ((demoUsage.inputTokens + demoUsage.outputTokens) * turns).toLocaleString("en-US"),
  cost: `$${(demoUsage.costUsd * turns).toFixed(4)}`,
})

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
    await window.getByRole("dialog").getByRole("button", { name: "Trust and open" }).click()
    await expect(window.getByTestId("project-name")).toHaveText("my-project")

    await window.getByRole("complementary").getByRole("button", { name: "New session" }).click()
    await window.getByRole("textbox", { name: "Message" }).fill("How many files are there?")
    await window.getByRole("textbox", { name: "Message" }).press("Enter")

    const items = window.getByTestId("transcript-item")
    await expect(items.filter({ hasText: "How many files are there?" })).toHaveCount(1)
    await expect(items.filter({ hasText: scriptedAnswer })).toHaveCount(1)
    const status = window.getByTestId("composer-status")
    await expect(status).toContainText(usageTotals(1).tokens)
    await expect(status).toContainText(usageTotals(1).cost)

    await window.getByRole("textbox", { name: "Message" }).fill("And now?")
    await window.getByRole("textbox", { name: "Message" }).press("Enter")
    // The usage totals show the second turn is done; the virtual list renders only its tail.
    await expect(status).toContainText(usageTotals(2).tokens)
    await expect(status).toContainText(usageTotals(2).cost)
    await expect(items.filter({ hasText: "And now?" })).toHaveCount(1)
    await expect(items.filter({ hasText: scriptedAnswer }).last()).toBeVisible()
  } finally {
    await first.close()
  }

  const second = await launchPackagedApp(userDataDir)
  try {
    const window = await second.firstWindow()
    await window
      .getByTestId("session-item")
      .filter({ hasText: "How many files are there?" })
      .getByTestId("session-title")
      .click()

    // The list opens at the bottom, so only the last turn is rendered.
    const items = window.getByTestId("transcript-item")
    await expect(items.filter({ hasText: "And now?" })).toHaveCount(1)
    await expect(items.filter({ hasText: scriptedAnswer }).last()).toBeVisible()
  } finally {
    await second.close()
  }
})
