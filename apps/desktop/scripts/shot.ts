import { _electron as electron } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempDir } from "../e2e/launch-app.ts"
import { sendMessage, startSession } from "../e2e/session-helpers.ts"

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(desktopDir, "shots")

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const app = await electron.launch({
  args: [join(desktopDir, "dist/main.js"), `--user-data-dir=${makeTempDir("user-data")}`],
  env: { ...process.env, IVIN_BACKGROUND: "1", IVIN_HARNESS: "scripted-approval" },
})

// A repository with a linked worktree, a second branch and an origin, so the working folder menu
// and the branch picker have something to list.
const makeRepo = (dir: string) => {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "ivin",
    GIT_AUTHOR_EMAIL: "ivin@example.com",
    GIT_COMMITTER_NAME: "ivin",
    GIT_COMMITTER_EMAIL: "ivin@example.com",
  }
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, env })
  git("init", "--quiet", "-b", "main")
  writeFileSync(join(dir, "README.md"), "hello")
  git("add", "README.md")
  git("commit", "--quiet", "-m", "first")
  git("worktree", "add", "--quiet", "-b", "docs/adr", join(dir, ".worktrees", "docs-adr"))
  git("branch", "fix/typo")
  git("init", "--quiet", "--bare", `${dir}.origin.git`)
  git("remote", "add", "origin", `${dir}.origin.git`)
  git("branch", "feat/remote")
  git("push", "--quiet", "origin", "main", "feat/remote")
  git("branch", "-D", "--quiet", "feat/remote")
}

const written: string[] = []
try {
  const window = await startSession(app, makeRepo)
  const shoot = async (name: string) => {
    const path = join(outDir, `${String(written.length + 1).padStart(2, "0")}-${name}.png`)
    await window.screenshot({ path })
    written.push(path)
  }

  await shoot("new-session")
  await window.getByTestId("branch-picker").click()
  await window.getByTestId("branch-row").filter({ hasText: "feat/remote" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("branch-picker")
  await window.keyboard.press("Escape")
  await window.getByTestId("branch-row").first().waitFor({ state: "detached" })
  await window.getByTestId("working-folder-picker").click()
  await window.getByRole("option", { name: "New worktree" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("working-folder-menu")
  await window.getByRole("option", { name: "New worktree" }).click()
  await window.getByText(/^New branch from/).waitFor()
  await shoot("new-worktree")
  // A pasted screenshot: a terminal with a failing test, drawn in the window.
  const box = window.getByRole("textbox", { name: "Message" })
  await box.click()
  await window.keyboard.type("How many files are there? The tests fail here: ")
  await box.evaluate(
    (field) =>
      new Promise<void>((resolve) => {
        const canvas = document.createElement("canvas")
        canvas.width = 960
        canvas.height = 540
        const g = canvas.getContext("2d")!
        g.fillStyle = "#14181b"
        g.fillRect(0, 0, 960, 540)
        g.font = "20px Menlo, monospace"
        const lines: Array<[string, string]> = [
          ["#9aa5ad", "$ pnpm test src/orders"],
          ["#61c554", "✓ src/orders/total.test.ts (6)"],
          ["#e5533b", "✗ src/orders/list.test.ts > lists an empty page"],
          ["#e5533b", "  TypeError: Cannot read properties of undefined (reading 'map')"],
          ["#7d8a93", "    at OrderList (src/orders/list.tsx:18:22)"],
        ]
        lines.forEach(([colour, text], i) => {
          g.fillStyle = colour
          g.fillText(text, 32, 60 + i * 40)
        })
        canvas.toBlob((blob) => {
          const data = new DataTransfer()
          data.items.add(new File([blob!], "Screenshot.png", { type: "image/png" }))
          field.dispatchEvent(
            new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
          )
          resolve()
        })
      }),
  )
  await window.getByTestId("draft-images").waitFor()
  await window.keyboard.type("can you check?")
  await shoot("composer-image")
  await box.press("Enter")
  await window.getByRole("button", { name: "View image #1" }).first().waitFor()
  await window
    .getByTestId("composer-status")
    .getByText(/tokens|\$/)
    .first()
    .waitFor()
  await shoot("message-image")
  await window.getByRole("button", { name: "View image #1" }).first().click()
  await window.getByRole("dialog").waitFor()
  await window.waitForTimeout(300)
  await shoot("image-viewer")
  await window.keyboard.press("Escape")
  await window.getByRole("dialog").waitFor({ state: "detached" })
  await window
    .getByTestId("composer-status")
    .getByText(/tokens|\$/)
    .first()
    .waitFor()
  await shoot("answer")
  await sendMessage(window, "Run the tests")
  await window
    .getByTestId("transcript-item")
    .and(window.locator('[data-type="approval"]'))
    .waitFor()
  await shoot("approval")
  const sidebar = window.getByRole("complementary")
  await sidebar.getByRole("button", { name: "New session" }).first().click()
  await sidebar.getByTestId("working-session").waitFor()
  await window.waitForTimeout(300)
  await shoot("working-panel")
  await sidebar.getByTestId("working-session").getByRole("button").first().click()
  await sidebar.getByTestId("working-panel").waitFor({ state: "detached" })
  const closeTab = async (title: string) => {
    const tab = window.getByTestId("tab").filter({ hasText: title }).first()
    await tab.hover()
    await tab.getByRole("button", { name: `Close ${title}` }).click()
  }
  await closeTab("How many files are there?")
  await window.getByRole("button", { name: "Stop and close" }).waitFor()
  await window.waitForTimeout(400)
  await shoot("close-running-tab")
  await window.getByRole("button", { name: "Stop and close" }).click()
  await window.getByRole("dialog").waitFor({ state: "detached" })
  await sidebar.getByRole("button", { name: "New session" }).first().click()
  await closeTab("New session")
  await sidebar.getByRole("button", { name: "New session" }).first().click()
  await sidebar.getByText(/^Inactive sessions/).click()
  await sidebar.getByTestId("inactive-session").nth(1).waitFor()
  await window.waitForTimeout(300)
  await shoot("inactive-sessions")
  const inactive = sidebar.getByTestId("inactive-session").first()
  await inactive.hover()
  await inactive.getByRole("button", { name: /^Actions for/ }).click()
  await window.getByRole("menuitem", { name: "Archive" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("session-menu")
  await window.getByRole("menuitem", { name: "Archive" }).click()
  await window.getByRole("menuitem").first().waitFor({ state: "detached" })
  await window.keyboard.press(process.platform === "darwin" ? "Meta+Shift+A" : "Control+Shift+A")
  await sidebar.getByTestId("archived-session").first().waitFor()
  await window.waitForTimeout(300)
  await shoot("archived-sessions")
} finally {
  await app.close()
}

for (const path of written) console.log(relative(process.cwd(), path))
