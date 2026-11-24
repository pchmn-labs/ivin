import { _electron as electron, type Locator } from "@playwright/test"
import { execFileSync } from "node:child_process"
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { makeTempDir } from "../e2e/launch-app.ts"
import { descendantsOf } from "../e2e/processes.ts"
import { sendMessage } from "../e2e/session-helpers.ts"

const desktopDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(desktopDir, "shots")

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const app = await electron.launch({
  args: [join(desktopDir, "dist/main.js"), `--user-data-dir=${makeTempDir("user-data")}`],
  env: { ...process.env, IVIN_BACKGROUND: "1", IVIN_HARNESS: "scripted-shot" },
})

// A repository with a linked worktree, a second branch and an origin, so the working folder menu
// and the branch picker have something to list.
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "ivin",
  GIT_AUTHOR_EMAIL: "ivin@example.com",
  GIT_COMMITTER_NAME: "ivin",
  GIT_COMMITTER_EMAIL: "ivin@example.com",
}
let repo = ""
const makeRepo = (dir: string) => {
  repo = dir
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, env: gitEnv })
  git("init", "--quiet", "-b", "main")
  writeFileSync(join(dir, "README.md"), "hello")
  writeFileSync(join(dir, ".gitignore"), "dist/\n")
  for (const file of [
    "src/orders/list.tsx",
    "src/orders/total.ts",
    "src/orders/total.test.ts",
    "src/main.ts",
    "dist/out.js",
    "package.json",
    "tsconfig.json",
  ]) {
    mkdirSync(join(dir, dirname(file)), { recursive: true })
    writeFileSync(join(dir, file), "")
  }
  writeFileSync(
    join(dir, "src/orders/total.ts"),
    `import type { Order } from "./order.ts"

// Cents, so a sum of prices never drifts.
export const total = (orders: ReadonlyArray<Order>): number =>
  orders.reduce((sum, order) => sum + order.priceCents * order.quantity, 0)

export const formatTotal = (cents: number, currency = "EUR") =>
  new Intl.NumberFormat("en", { style: "currency", currency }).format(cents / 100)
`,
  )
  git("add", ".")
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
  const projectDir = join(makeTempDir("projects"), "my-project")
  mkdirSync(projectDir)
  makeRepo(projectDir)
  const window = await app.firstWindow()
  const shoot = async (name: string) => {
    const path = join(outDir, `${String(written.length + 1).padStart(2, "0")}-${name}.png`)
    await window.screenshot({ path })
    written.push(path)
  }
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [path] })
  }, projectDir)
  await window.getByRole("button", { name: "Open folder…" }).click()
  await window.getByRole("dialog").getByRole("button", { name: "Trust and open" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("trust-project")
  await window.getByRole("dialog").getByRole("button", { name: "Trust and open" }).click()
  await window.getByTestId("project-name").getByText("my-project").waitFor()
  await window.getByRole("complementary").getByRole("button", { name: "New session" }).click()

  // The virtual list draws only the rows near the view, so a row above it is reached by scrolling.
  const scrollUpTo = async (target: Locator) => {
    const transcript = window.getByTestId("transcript")
    await transcript.hover()
    const inView = async () => {
      const [box, view] = await Promise.all([
        target.boundingBox({ timeout: 100 }).catch(() => null),
        transcript.boundingBox(),
      ])
      return (
        box !== null &&
        view !== null &&
        box.y >= view.y &&
        box.y + box.height <= view.y + view.height
      )
    }
    for (let wheel = 0; !(await inView()); wheel++) {
      if (wheel === 50) throw new Error("The transcript never scrolled up to its target")
      await window.mouse.wheel(0, -200)
    }
  }

  await shoot("new-session")
  // Only a packaged build checks for updates, so main sends the window the states it would.
  const sendUpdateState = (state: object) =>
    app.evaluate(({ BrowserWindow }, update) => {
      for (const win of BrowserWindow.getAllWindows())
        win.webContents.send("ivin:update:state", update)
    }, state)
  const release = {
    current: "0.3.2",
    version: "0.4.0",
    notes:
      "### Features\n\n- show a session whose agent runs background tasks as in background\n- resize the files card and show file icons in its tabs\n\n### Fixes\n\n- keep a running step's calls where the user wheeled up",
    url: "https://github.com/pchmn-labs/ivin/releases/tag/v0.4.0",
  }
  await sendUpdateState({ kind: "ready", ...release })
  await window.getByRole("button", { name: "Restart to update" }).hover()
  await window.getByText("ivin 0.4.0 is ready. Restart to update.").waitFor()
  await window.waitForTimeout(300)
  await shoot("update-ready")
  await sendUpdateState({ kind: "failed", current: "0.3.2", reason: "notWritable" })
  await window.getByRole("button", { name: "Update failed" }).hover()
  await window.getByText(/Move ivin to a folder you can write to/).waitFor()
  await window.waitForTimeout(300)
  await shoot("update-failed")
  await sendUpdateState({ kind: "idle", current: "0.3.2" })
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
  await window.getByTestId("run-options").click()
  await window.getByRole("listbox", { name: "Permissions" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("run-options-menu")
  await window.keyboard.press("Escape")
  await window.getByRole("listbox", { name: "Permissions" }).waitFor({ state: "detached" })
  await sendMessage(window, "The order list crashes on an empty page, can you fix it?")
  await window.getByText("pnpm test src/orders", { exact: false }).last().waitFor()
  // The answer is taller than the view, so the transcript follows its end, past the turn's label.
  await scrollUpTo(window.getByText(/^Worked for/).last())
  await window.waitForTimeout(300)
  await shoot("turn-folded")
  await window.getByText("export function OrderList({", { exact: false }).last().hover()
  await window.getByRole("button", { name: "Copy" }).last().waitFor()
  await window.waitForTimeout(300)
  await shoot("answer-code-copy")
  await scrollUpTo(window.getByTestId("turn-line").last())
  await window.getByTestId("turn-line").last().click()
  await window.getByTestId("turn-step").first().waitFor()
  await window.waitForTimeout(300)
  await shoot("turn-unfolded")
  await sendMessage(window, "Add tests for the order totals")
  await window.getByTestId("question-sheet").waitFor()
  await window.waitForTimeout(300)
  await shoot("question")
  await window.keyboard.press("1")
  await window.getByText("Choose one or more").waitFor()
  await window.keyboard.press("Space")
  await window.keyboard.press("ArrowDown")
  await window.keyboard.press("Space")
  await shoot("question-multiple")
  await window.keyboard.press("Enter")
  await window.getByTestId("question-sheet").waitFor({ state: "detached" })
  await window.getByText("Thanks, I'll write them that way.").waitFor()
  await window.waitForTimeout(300)
  await shoot("question-answered")
  await sendMessage(window, "Does the orders folder type check?")
  await window.getByText("Approval needed").waitFor()
  await window.waitForTimeout(300)
  await shoot("sent-message-approval")
  await window.getByRole("radio", { name: "Allow" }).focus()
  await window.keyboard.press("Enter")
  await window.getByText("Approval needed").waitFor({ state: "detached" })
  await window.getByText("The orders folder type checks with no error.").waitFor()
  await window.waitForTimeout(300)
  await shoot("sent-message-after-approval")
  await sendMessage(window, "Run the tests")
  await window.getByText("Approval needed").waitFor()
  await shoot("approval")
  await window.getByRole("textbox", { name: "Message" }).click()
  await window.keyboard.type("Leave the e2e tests out of this")
  await window.keyboard.press("Enter")
  await window.getByTestId("composer-pending").waitFor()
  await window.waitForTimeout(300)
  await shoot("steer-pending")
  await window.getByRole("radio", { name: "Allow" }).focus()
  await window.keyboard.press("Enter")
  await window.getByTestId("turn-steer").waitFor()
  await window.getByTestId("composer-pending").waitFor({ state: "detached" })
  await window.waitForTimeout(300)
  await shoot("steer")
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
  await sidebar.getByText(/^Inactive sessions/).click()
  await sidebar
    .getByTestId("inactive-session")
    .filter({ hasText: "How many files are there?" })
    .click()
  await window.getByText("Not answered:").waitFor()
  await window.waitForTimeout(300)
  await shoot("approval-not-answered")
  await closeTab("How many files are there?")
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
  await window.getByRole("menuitem", { name: "Archive" }).hover()
  await window.waitForTimeout(300)
  await shoot("session-menu")
  await window.getByRole("menuitem", { name: "Archive" }).click()
  await window.getByRole("menuitem").first().waitFor({ state: "detached" })
  await window.keyboard.press(process.platform === "darwin" ? "Meta+Shift+A" : "Control+Shift+A")
  await sidebar.getByTestId("archived-session").first().waitFor()
  await window.waitForTimeout(300)
  await shoot("archived-sessions")
  await window.keyboard.press("Escape")
  await sidebar.getByRole("tab", { name: "Files" }).click()
  await sidebar.getByRole("treeitem", { name: "src", exact: true }).click()
  await sidebar.getByRole("treeitem", { name: "orders", exact: true }).click()
  await sidebar.getByRole("treeitem", { name: "list.tsx", exact: true }).waitFor()
  await window.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>(".iv-tree__icon img")).every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  )
  await window.waitForTimeout(300)
  await shoot("files-tab")
  // A commit ahead of origin and uncommitted edits, for the Changes tab's two lists.
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, env: gitEnv })
  git("remote", "set-head", "origin", "main")
  writeFileSync(join(repo, "src/orders/empty-page.ts"), "export const EMPTY_PAGE = []\n")
  git("add", "src/orders/empty-page.ts")
  git("commit", "--quiet", "-m", "empty page")
  writeFileSync(join(repo, "README.md"), "hello\n\nOrders, with totals in cents.\n")
  writeFileSync(join(repo, "src/main.ts"), 'import { total } from "./orders/total.ts"\n')
  writeFileSync(join(repo, "NOTES.md"), "- empty page\n")
  await sidebar.getByRole("tab", { name: /^Changes/ }).click()
  await sidebar
    .getByRole("list", { name: "Committed changes" })
    .getByText("empty-page.ts")
    .waitFor()
  await sidebar.getByRole("list", { name: "Uncommitted changes" }).getByText("NOTES.md").waitFor()
  await window.waitForTimeout(300)
  await shoot("changes-tab")
  await sidebar.getByRole("list", { name: "Uncommitted changes" }).getByText("README.md").hover()
  await window.getByRole("button", { name: "Discard the changes to README.md" }).click()
  await window.getByRole("dialog").waitFor()
  await window.waitForTimeout(300)
  await shoot("discard-dialog")
  await window.keyboard.press("Escape")
  await window.getByRole("dialog").waitFor({ state: "detached" })
  mkdirSync(join(repo, "scratch"))
  for (let i = 1; i <= 60; i++) writeFileSync(join(repo, "scratch", `generated-file-${i}.txt`), "x")
  await sidebar
    .getByRole("list", { name: "Uncommitted changes" })
    .getByText("generated-file-60.txt")
    .waitFor()
  await sidebar.getByRole("list", { name: "Uncommitted changes" }).getByText("README.md").hover()
  await window.getByRole("button", { name: "Discard all uncommitted changes" }).click()
  await window
    .getByRole("dialog")
    .getByRole("button", { name: /^Discard/ })
    .last()
    .waitFor()
  await window.waitForTimeout(300)
  await shoot("discard-all-dialog")
  await window.keyboard.press("Escape")
  await window.getByRole("dialog").waitFor({ state: "detached" })
  await sidebar.getByRole("tab", { name: "Files" }).click()
  await sidebar.getByRole("treeitem", { name: "list.tsx", exact: true }).click()
  await sidebar.getByRole("treeitem", { name: "total.ts", exact: true }).click()
  await window.getByRole("textbox", { name: "total.ts" }).getByText("formatTotal").waitFor()
  await window.waitForTimeout(300)
  await shoot("open-file")
  for (const [name, label] of [
    ["resize-files-card", "Resize the files card"],
    ["resize-sidebar", "Resize the sidebar"],
  ] as const) {
    const box = await window.getByRole("separator", { name: label }).boundingBox()
    if (box === null) throw new Error(`No handle: ${label}`)
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await window.mouse.move(x, y)
    await window.mouse.down()
    await window.mouse.move(x + (name === "resize-sidebar" ? 12 : -12), y, { steps: 3 })
    await window.waitForTimeout(300)
    await shoot(name)
    await window.mouse.up()
    await window.getByRole("separator", { name: label }).dblclick()
  }
  await window.getByRole("textbox", { name: "total.ts" }).getByText("formatTotal").first().click()
  await window.keyboard.type(" ")
  await window.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+Backspace" : "Control+Shift+Backspace",
  )
  await window.getByRole("dialog").waitFor()
  await window.waitForTimeout(300)
  await shoot("archive-unsaved-edits")
  await window.getByRole("dialog").getByRole("button", { name: "Cancel" }).click()
  await window.getByRole("dialog").waitFor({ state: "detached" })
  await window.keyboard.press(process.platform === "darwin" ? "Meta+S" : "Control+S")
  const card = window.getByRole("region", { name: "Open files" })
  await card.getByRole("button", { name: "Full width" }).click()
  await card.getByRole("button", { name: "Beside chat" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("full-width-file")
  await card.getByRole("tab", { name: "Session", exact: true }).click()
  await window.getByRole("textbox", { name: "Message" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("full-width-session")
  await window.keyboard.press(process.platform === "darwin" ? "Meta+Comma" : "Control+Comma")
  await window.getByRole("navigation", { name: "Settings sections" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("settings")
  await window
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Agents" })
    .click()
  await window.getByRole("heading", { name: "Agents" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("settings-agents")
  await window
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Updates" })
    .click()
  await window.getByRole("heading", { name: "Updates" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("settings-updates")
  await window
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Command line" })
    .click()
  await window.getByRole("heading", { name: "Command line" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("settings-command-line")
  await window
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("button", { name: "Sidebar" })
    .click()
  await window.getByRole("combobox", { name: "Projects" }).selectOption("strip")
  await window.waitForTimeout(300)
  await shoot("settings-sidebar")
  await window.getByRole("button", { name: "Back to sessions" }).click()
  await window.getByRole("group", { name: "Projects" }).waitFor()
  await window.waitForTimeout(300)
  await shoot("strip-layout")
  // A repository git cannot read: the lists and the status fail instead of showing nothing.
  appendFileSync(join(repo, ".git/config"), "[broken\n")
  // The status is read again after a change on disk.
  writeFileSync(join(repo, "notes.txt"), "a change")
  await sidebar.getByRole("tab", { name: "Files" }).click()
  await sidebar.getByRole("button", { name: "Retry" }).first().waitFor()
  await window.waitForTimeout(300)
  await shoot("files-git-failure")
  await window.getByTestId("branch-picker").click()
  await window.getByTestId("branch-picker-git-message").waitFor()
  await window.waitForTimeout(300)
  await shoot("branch-picker-git-failure")
  await window.keyboard.press("Escape")
  const [server] = descendantsOf(app.process().pid!).filter((proc) =>
    proc.command.includes("node.mojom.NodeService"),
  )
  process.kill(server!.pid, "SIGKILL")
  await window
    .getByRole("alert")
    .getByText(/Restarting it/)
    .waitFor()
  await shoot("server-restarting")
} finally {
  await app.close()
}

for (const path of written) console.log(relative(process.cwd(), path))
