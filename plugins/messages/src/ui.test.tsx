import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { activatePlugin } from "../../../packages/ui/src/app/test-plugin-mount.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { SlotProps } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const mount = async (item: SlotProps["transcript.message"]["item"]) => {
  const Message = activatePlugin(activate, "messages")("transcript.message")
  const host = {
    ...testUiHost,
  }
  await render(
    <UiHostProvider host={host}>
      <Message item={item} sessionId="s1" />
    </UiHostProvider>,
  )
}

const base = { id: "i0", sessionId: "s1", position: 0, at: 0, steer: false }

test("an assistant message renders Markdown", async () => {
  await mount({
    ...base,
    type: "message",
    role: "assistant",
    text: "Some **bold** text\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |",
    images: [],
  })
  await expect.element(page.getByText("bold", { exact: true })).toBeVisible()
  expect(document.querySelector("strong + strong, p strong")?.textContent).toBe("bold")
  await expect.element(page.getByRole("listitem").first()).toHaveTextContent("one")
  await expect.element(page.getByRole("table")).toBeVisible()
})

test("a user message stays plain text", async () => {
  await mount({ ...base, type: "message", role: "user", text: "**not bold**", images: [] })
  await expect.element(page.getByText("**not bold**")).toBeVisible()
})

test("a user message shows its images as thumbnails, and each marker in its text as the image's marker", async () => {
  await mount({
    ...base,
    type: "message",
    role: "user",
    text: "it fails here: [Image #2] see?",
    images: [{ id: "img-2", number: 2, mediaType: "image/png" }],
  })
  await expect.element(page.getByText("it fails here:", { exact: false })).toBeVisible()
  expect(page.getByRole("button", { name: "View image #2" }).elements()).toHaveLength(2)
  expect(document.body.textContent).not.toContain("[Image #2]")
})

test("thinking is not shown", async () => {
  await mount({ ...base, type: "thinking", text: "secret reasoning" })
  expect(page.getByText("secret reasoning").query()).toBeNull()
})

test("an error item is shown as an alert", async () => {
  await mount({ ...base, type: "error", message: "The run failed" })
  await expect.element(page.getByRole("alert")).toHaveTextContent("Error: The run failed")
})

test("an interruption is shown as a short note", async () => {
  await mount({ ...base, type: "interruption" })
  await expect.element(page.getByText("Interrupted")).toBeVisible()
})

test("a stopped task is shown as a note naming it", async () => {
  await mount({
    ...base,
    type: "task_stop",
    taskId: "k1",
    description: "Wait 900 seconds in the background",
  })
  await expect.element(page.getByText("Stopped")).toBeVisible()
  await expect.element(page.getByText("Wait 900 seconds in the background")).toBeVisible()
})

const worktree = {
  ...base,
  type: "working_folder" as const,
  path: "/repo/.worktrees/feat-login",
  inWorktree: true,
  branch: "feat/login",
  cause: "creation" as const,
}

test("a new worktree names its branch and folder", async () => {
  await mount({ ...worktree, worktreesIgnored: true })
  await expect.element(page.getByText("Started in a new worktree on")).toBeVisible()
  await expect.element(page.getByText("feat/login")).toBeVisible()
  await expect.element(page.getByText("/repo/.worktrees/feat-login")).toBeVisible()
  expect(page.getByText(/not ignored by git/).query()).toBeNull()
})

test("a new worktree under a .worktrees/ that git does not ignore says what to add", async () => {
  await mount({ ...worktree, worktreesIgnored: false })
  const note = page.getByText(/not ignored by git/)
  await expect.element(note).toBeVisible()
  expect(note.element().textContent).toContain("Add .worktrees/ to .gitignore")
})

const checkout = { path: "/repo", inWorktree: false, branch: "main" }

test.each([
  [
    "the agent entering a worktree",
    { cause: "adoption" },
    "Moved to the worktree on",
    "feat/login",
  ],
  [
    "the agent leaving a worktree",
    { ...checkout, cause: "adoption" },
    "Back in the checkout on",
    "main",
  ],
  ["a folder picked after a deletion", { cause: "pick" }, "Moved to the worktree on", "feat/login"],
  ["a pick of the checkout", { ...checkout, cause: "pick" }, "Moved to the checkout on", "main"],
] as const)("%s says where the session moved", async (_, change, phrase, branch) => {
  await mount({ ...worktree, ...change, worktreesIgnored: true })
  await expect.element(page.getByText(phrase)).toBeVisible()
  await expect.element(page.getByText(branch, { exact: true })).toBeVisible()
})

test("a branch picked in the branch picker names the branch and the folder it is checked out in", async () => {
  await mount({
    ...worktree,
    path: "/repo",
    inWorktree: false,
    branch: "fix/typo",
    cause: "branch_picker",
    worktreesIgnored: true,
  })
  await expect.element(page.getByText("Switched to")).toBeVisible()
  await expect.element(page.getByText("fix/typo")).toBeVisible()
  await expect.element(page.getByText("/repo", { exact: true })).toBeVisible()
})
