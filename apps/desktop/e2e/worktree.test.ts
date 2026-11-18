import { expect, test } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { launchPackagedApp, makeTempDir } from "./launch-app.ts"
import { sendMessage } from "./session-helpers.ts"

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
}
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: gitEnv, encoding: "utf8" })

const makeRepoWithOrigin = () => {
  const root = makeTempDir("repo")
  const origin = join(root, "origin.git")
  const project = join(root, "my-project")
  git(root, "init", "--quiet", "--bare", "-b", "main", origin)
  git(root, "clone", "--quiet", origin, project)
  writeFileSync(join(project, "README.md"), "hello")
  git(project, "add", "README.md")
  git(project, "commit", "--quiet", "-m", "first")
  git(project, "push", "--quiet", "origin", "HEAD:main")
  return project
}

test("a session started in a new worktree shows its branch in the composer and the sidebar", async () => {
  const project = makeRepoWithOrigin()
  const app = await launchPackagedApp(makeTempDir("user-data"))
  try {
    const window = await app.firstWindow()
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] })
    }, project)
    await window.getByRole("button", { name: "Open folder…" }).click()
    await expect(window.getByTestId("project-name")).toHaveText("my-project")
    await window.getByRole("complementary").getByRole("button", { name: "New session" }).click()

    await window.getByRole("combobox", { name: "Working folder" }).selectOption("worktree")
    await window.getByRole("textbox", { name: "Branch name" }).fill("feat/e2e")
    await sendMessage(window, "hello")

    await expect(window.getByRole("combobox", { name: "Working folder" })).toHaveCount(0)
    await expect(window.getByRole("main").getByTestId("session-location")).toContainText("feat/e2e")
    await expect(window.getByTestId("session-item").getByTestId("session-location")).toContainText(
      "feat/e2e",
    )
    expect(existsSync(join(project, ".worktrees", "feat-e2e", "README.md"))).toBe(true)
  } finally {
    await app.close()
  }
})
