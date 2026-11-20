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

// A repository with a linked worktree and a second branch, so the working folder menu and the
// branch picker have something to list.
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
  await window.getByTestId("branch-row").filter({ hasText: "docs/adr" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("branch-picker")
  await window.keyboard.press("Escape")
  await window.getByTestId("branch-row").first().waitFor({ state: "detached" })
  await window.getByTestId("working-folder-picker").click()
  await window.getByRole("menuitemradio", { name: "New worktree" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("working-folder-menu")
  await window.getByRole("menuitemradio", { name: "New worktree" }).click()
  await window.getByText(/^New branch from/).waitFor()
  await shoot("new-worktree")
  await sendMessage(window, "How many files are there?")
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
} finally {
  await app.close()
}

for (const path of written) console.log(relative(process.cwd(), path))
