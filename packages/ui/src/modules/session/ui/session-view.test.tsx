import { RegistryProvider } from "@effect/atom-react"
import type { Harness } from "@ivin/contracts/session"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { type FakeCheckout, makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { SessionList } from "./session-list.tsx"
import { SessionView } from "./session-view.tsx"

test("the transcript renders through the plugins and the status line shows the usage", async () => {
  const server = makeFakeServer()
  const base = { sessionId: "s1" }
  server.seedItems("s1", [
    { ...base, id: "m0", position: 0, type: "message", role: "user", text: "hello" },
    {
      ...base,
      id: "t1",
      position: 1,
      type: "tool_call",
      toolCallId: "c1",
      name: "Bash",
      input: null,
      status: "done",
      output: "ok",
    },
    {
      ...base,
      id: "u2",
      position: 2,
      type: "usage",
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.01,
    },
    {
      ...base,
      id: "u3",
      position: 3,
      type: "usage",
      inputTokens: 300,
      outputTokens: 40,
      costUsd: 0.0023,
    },
  ])
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "t",
    harness: "claude",
    model: "sonnet",
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  })

  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("hello", { exact: true })).toBeVisible()
  await expect.element(page.getByTestId("tool-output")).toBeVisible()
  expect(document.querySelectorAll('[data-testid="transcript-item"]')).toHaveLength(2)
  await expect
    .element(page.getByTestId("composer-status"))
    .toHaveTextContent("1,540 tokens · $0.0123")
})

const mountSession = async (
  status: "idle" | "working" | "waiting",
  harness: Harness = "claude",
) => {
  const server = makeFakeServer()
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "t",
    harness,
    model: "sonnet",
    status,
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

test("a codex session's composer names Codex and draws no Claude mark", async () => {
  await mountSession("idle", "codex")
  await expect.element(page.getByPlaceholder("Message Codex")).toBeVisible()
  const model = page.getByTestId("composer-model").element()
  expect(model.querySelector(".iv-harness-mark--agent")).not.toBeNull()
  expect(document.querySelector(".iv-composer .iv-harness-mark--claude")).toBeNull()
})

test("a claude session's composer names Claude and draws the Claude mark", async () => {
  await mountSession("idle")
  await expect.element(page.getByPlaceholder("Message Claude")).toBeVisible()
  expect(
    page.getByTestId("composer-model").element().querySelector(".iv-harness-mark--claude"),
  ).not.toBeNull()
})

test("the composer announces the status and follows the server", async () => {
  const server = await mountSession("idle")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
  server.setStatus("s1", "waiting")
  await expect
    .element(page.getByTestId("composer-session-status"))
    .toHaveTextContent("Waiting for you")
})

test("the Interrupt button shows only while the session works and interrupts it", async () => {
  const server = await mountSession("idle")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
  expect(page.getByRole("button", { name: "Interrupt" }).query()).toBeNull()

  server.setStatus("s1", "working")
  await page.getByRole("button", { name: "Interrupt" }).click()
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
  await expect.element(page.getByText("Interrupted")).toBeVisible()
  expect(page.getByRole("button", { name: "Interrupt" }).query()).toBeNull()
})

test("Escape in the composer interrupts a working session", async () => {
  await mountSession("working")
  await page.getByRole("textbox", { name: "Message" }).click()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
})

test("the composer accepts a message while the session works", async () => {
  const server = await mountSession("working")
  await page.getByRole("textbox", { name: "Message" }).fill("also this")
  await page.getByRole("button", { name: "Send" }).click()
  await expect.element(page.getByText("also this", { exact: true })).toBeVisible()
  await vi.waitFor(() => expect(server.sentMessages).toHaveLength(1))
})

test("a message that fails to send stays in the composer, and Retry sends it", async () => {
  const server = await mountSession("idle")
  const send = server.holdNextSend()
  const field = page.getByRole("textbox", { name: "Message" })
  await field.fill("keep me")
  await page.getByRole("button", { name: "Send" }).click()
  await expect.element(field).toHaveValue("")

  send.fail()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText("The message was not sent.")).toBeVisible()
  await expect.element(field).toHaveValue("keep me")
  expect(server.errorReports.map((report) => report.action)).toContain("session.sendMessage")

  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("keep me", { exact: true })).toBeVisible()
  await expect.element(field).toHaveValue("")
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await vi.waitFor(() => expect(server.sentMessages).toHaveLength(2))
})

test("a message to a session the server no longer has says so, with no Retry", async () => {
  const server = await mountSession("idle")
  server.sessions.delete("s1")
  await page.getByRole("textbox", { name: "Message" }).fill("hello")
  await page.getByRole("button", { name: "Send" }).click()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByText(/^This session no longer exists/)).toBeVisible()
  expect(alert.getByRole("button", { name: "Retry" }).query()).toBeNull()
  await expect.element(page.getByRole("textbox", { name: "Message" })).toHaveValue("hello")
})

test("Escape interrupts a working session wherever the focus is", async () => {
  await mountSession("working")
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
})

test("Escape in the rename input cancels the rename and does not interrupt", async () => {
  const server = makeFakeServer()
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "t",
    harness: "claude",
    model: "sonnet",
    status: "working",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  })
  server.openProject("/p")
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionList projectPath="/p" projectName="p" />
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await page.getByRole("button", { name: "Session actions" }).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole("textbox", { name: "Session title" })).not.toBeInTheDocument()
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(server.sessions.get("s1")?.status).toBe("working")
})

test("a pending approval shows a sheet on the composer that Enter allows, leaving no record", async () => {
  const server = await mountSession("waiting")
  server.pushItem({
    id: "a0",
    sessionId: "s1",
    position: 0,
    type: "approval",
    requestId: "r1",
    toolCallId: null,
    name: "Bash",
    input: { command: "git push" },
    decision: null,
  })
  await expect.element(page.getByText("Approval needed")).toBeVisible()
  await page.getByRole("textbox", { name: "Message" }).click()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByText("Approval needed")).not.toBeInTheDocument()
  await expect.element(page.getByTestId("transcript-item")).toHaveAttribute("data-type", "approval")
  expect(page.getByTestId("approval-decision").query()).toBeNull()
  expect(page.getByTestId("transcript-item").element().getBoundingClientRect().height).toBe(1)
})

const pushApproval = (server: Awaited<ReturnType<typeof mountSession>>) =>
  server.pushItem({
    id: "a0",
    sessionId: "s1",
    position: 0,
    type: "approval",
    requestId: "r1",
    toolCallId: null,
    name: "Bash",
    input: { command: "git push" },
    decision: null,
  })

test("Enter with the focus on the page body does not answer an approval", async () => {
  const server = await mountSession("waiting")
  pushApproval(server)
  await expect.element(page.getByText("Approval needed")).toBeVisible()
  ;(document.activeElement as HTMLElement | null)?.blur()
  await userEvent.keyboard("{Enter}")
  await new Promise((resolve) => setTimeout(resolve, 200))
  await expect.element(page.getByText("Approval needed")).toBeVisible()
})

test("Enter in a composer with text sends the message and leaves the approval open", async () => {
  const server = await mountSession("waiting")
  pushApproval(server)
  await expect.element(page.getByText("Approval needed")).toBeVisible()
  await page.getByRole("textbox", { name: "Message" }).fill("also this")
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByText("also this", { exact: true })).toBeVisible()
  await expect.element(page.getByText("Approval needed")).toBeVisible()
})

test("with composer.send moved to mod+enter and enter removed, Enter inserts a new line", async () => {
  const server = await mountSession("idle")
  server.setUserKeybindings({
    keybindings: [
      { key: "mod+enter", command: "composer.send", when: "composer" },
      { key: "enter", command: "-composer.send", when: "composer" },
    ],
    problem: null,
  })
  const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"
  const field = page.getByRole("textbox", { name: "Message" })
  await field.click()
  await userEvent.keyboard("one{Enter}two")
  await expect.element(field).toHaveValue("one\ntwo")
  await page.getByRole("button", { name: "Send" }).hover()
  await expect.element(page.getByText(/^Send \((⌘|Ctrl\+)Enter\)$/)).toBeVisible()

  await field.click()
  await userEvent.keyboard(`{${mod}>}{Enter}{/${mod}}`)
  await expect.element(field).toHaveValue("")
  await expect.element(page.getByTestId("transcript-item")).toBeVisible()
})

test("Shift+Enter in the composer inserts a new line and does not send", async () => {
  await mountSession("idle")
  const field = page.getByRole("textbox", { name: "Message" })
  await field.click()
  await userEvent.keyboard("one{Shift>}{Enter}{/Shift}two")
  await expect.element(field).toHaveValue("one\ntwo")
})

test("Escape closes an open menu without interrupting the session", async () => {
  const server = makeFakeServer()
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "t",
    harness: "claude",
    model: "sonnet",
    status: "working",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  })
  server.openProject("/p")
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionList projectPath="/p" projectName="p" />
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await page.getByRole("button", { name: "Session actions" }).click()
  await expect.element(page.getByRole("menuitem", { name: "Rename" })).toBeVisible()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole("menuitem", { name: "Rename" })).not.toBeInTheDocument()
  await new Promise((resolve) => setTimeout(resolve, 200))
  expect(server.sessions.get("s1")?.status).toBe("working")
})

test("Enter on the focused Interrupt button presses it rather than running composer.send", async () => {
  await mountSession("working")
  await page.getByRole("button", { name: "Interrupt" }).element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
})

const mountNewSession = async (checkout: Partial<FakeCheckout> = {}) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  Object.assign(server.checkout, checkout)
  const at = DateTime.makeUnsafe(0)
  const session = {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: false,
    workingFolderDeleted: false,
    title: "New session",
    harness: "claude" as const,
    model: "sonnet",
    status: "idle" as const,
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  }
  server.sessions.set("s1", session)
  server.worktrees.push({ path: "/p/.worktrees/docs-adr", branch: "docs/adr" })
  server.sessions.set("s2", {
    ...session,
    id: "s2",
    workingFolder: "/p/.worktrees/docs-adr",
    inWorktree: true,
    branch: "docs/adr",
    started: true,
    title: "Write the ADR",
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

const picker = () => page.getByTestId("working-folder-picker")
const choose = async (name: string | RegExp) => {
  await picker().click()
  await page.getByRole("option", { name }).click()
}
const sendText = async (text: string) => {
  await page.getByRole("textbox", { name: "Message" }).fill(text)
  await page.getByRole("button", { name: "Send" }).click()
}

test("a new session asks for its task with the composer in the middle, and the working folder choice stays until the first message", async () => {
  const server = await mountNewSession()
  const title = page.getByRole("heading", { name: "What should we work on in shop?" })
  await expect.element(title).toBeVisible()
  expect(picker().element().textContent).toBe("Current checkout")

  await choose("New worktree")
  expect(picker().element().textContent).toBe("New worktree")
  await expect.element(page.getByText("New branch from origin/main")).toBeVisible()
  await sendText("go")

  await expect.element(title).not.toBeInTheDocument()
  await expect.element(picker()).not.toBeInTheDocument()
  await expect
    .element(page.getByTestId("session-location"))
    .toHaveTextContent("Worktreeivin/generated")
  await sendText("again")
  await vi.waitFor(() => expect(server.sentMessages).toHaveLength(2))
  expect(server.sentMessages.map((m) => m.workingFolder)).toEqual([
    { kind: "new_worktree" },
    undefined,
  ])
})

test("15 worktrees scroll inside the working folder menu; keyboard only filters, picks and returns focus", async () => {
  const server = await mountNewSession()
  for (let i = 0; i < 15; i++) {
    server.worktrees.push({ path: `/p/.worktrees/wt-${i}`, branch: `chore/wt-${i}` })
  }
  picker().element().focus()
  await userEvent.keyboard("{Enter}")
  const search = page.getByRole("combobox", { name: "Working folder" })
  await expect.element(search).toHaveFocus()
  const viewport = document.querySelector<HTMLElement>(".iv-composer-menu__viewport")!
  await expect.element(page.getByRole("option", { name: "chore/wt-0" })).toBeVisible()
  expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight)

  await userEvent.keyboard("wt-14")
  await expect.element(page.getByRole("option", { name: "chore/wt-0" })).not.toBeInTheDocument()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByText("chore/wt-14", { exact: true })).toBeVisible()
  expect(picker().element().textContent).toBe("Worktree")
  await expect.element(picker()).toHaveFocus()
})

test("the menu lists the project's worktrees with the session using each, and one can be picked", async () => {
  const server = await mountNewSession()
  await picker().click()
  const existing = page.getByRole("option", { name: /docs\/adr/ })
  expect(existing.element().textContent).toContain("Write the ADR")
  await existing.click()

  expect(picker().element().textContent).toBe("Worktree")
  await expect.element(page.getByText("docs/adr", { exact: true })).toBeVisible()
  await sendText("go")
  await vi.waitFor(() =>
    expect(server.sentMessages.map((m) => m.workingFolder)).toEqual([
      { kind: "existing_worktree", path: "/p/.worktrees/docs-adr" },
    ]),
  )
})

test("a worktree git cannot create shows git's message in the transcript and keeps the message and the choice", async () => {
  const server = await mountNewSession()
  server.failWorktreeWith("fatal: unable to access 'origin': Could not resolve host")
  await choose("New worktree")
  await sendText("go")

  const alert = page.getByTestId("composer-alert")
  await expect.element(alert).toBeVisible()
  expect(alert.element().textContent).toMatch(/^The worktree was not created/)
  await expect
    .element(
      page.getByText("fatal: unable to access 'origin': Could not resolve host", { exact: true }),
    )
    .toBeVisible()
  await expect.element(page.getByRole("textbox", { name: "Message" })).toHaveValue("go")
  expect(picker().element().textContent).toBe("New worktree")
})

test("a session preparing its worktree says so under the transcript until the run starts", async () => {
  const server = await mountNewSession()
  await page.getByRole("textbox", { name: "Message" }).fill("go")
  server.setStatus("s1", "preparing_worktree")
  const preparing = page.getByTestId("preparing-worktree")
  await expect.element(preparing).toBeVisible()
  expect(preparing.element().textContent).toBe("Preparing worktree…")
  await expect.element(page.getByRole("button", { name: "Send" })).toBeDisabled()
  server.setStatus("s1", "working")
  await expect.element(preparing).not.toBeInTheDocument()
})

const switchButton = () => page.getByRole("button", { name: "Switch to main" })

test("on another branch, a checkout with local changes asks to stash, commit or cancel before switching", async () => {
  const server = await mountNewSession({ branch: "feat/search", dirty: true })
  await switchButton().click()
  const dialog = page.getByRole("dialog", { name: "Uncommitted changes" })
  await expect.element(dialog).toBeVisible()

  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect.element(dialog).not.toBeInTheDocument()
  expect(server.checkout.branch).toBe("feat/search")

  await switchButton().click()
  const commit = page.getByRole("button", { name: "Commit & switch" })
  await expect.element(commit).toBeDisabled()
  await page.getByRole("textbox", { name: /Commit message/ }).fill("Keep the search draft")
  await commit.click()

  await expect.element(switchButton()).not.toBeInTheDocument()
  expect(server.localChangesChoices).toEqual([{ kind: "commit", message: "Keep the search draft" }])
  expect(server.checkout.branch).toBe("main")
})

test("stashing the local changes switches to the default branch", async () => {
  const server = await mountNewSession({ branch: "feat/search", dirty: true })
  await switchButton().click()
  await page.getByRole("button", { name: "Stash & switch" }).click()

  await expect.element(switchButton()).not.toBeInTheDocument()
  expect(server.localChangesChoices).toEqual([{ kind: "stash" }])
  await expect.element(page.getByText("main", { exact: true })).toBeVisible()
})

test("a branch behind origin pulls in one click, and a pull refused by local changes shows git's message and stashes on request", async () => {
  const gitMessage =
    "error: Your local changes to the following files would be overwritten by merge"
  const server = await mountNewSession({ behind: 3, dirty: true, pullRefusal: gitMessage })
  const pull = page.getByRole("button", { name: "Pull 3 commits from origin/main" })
  expect(pull.element().textContent).toBe("3")
  await pull.click()

  const dialog = page.getByRole("dialog", { name: "Pull failed" })
  await expect.element(dialog.getByText(gitMessage, { exact: true })).toBeVisible()
  await dialog.getByRole("button", { name: "Stash & pull" }).click()

  await expect.element(pull).not.toBeInTheDocument()
  expect(server.localChangesChoices).toEqual(["stash before pull"])
})

test("the switch and pull buttons are gone once the first message is sent, and absent for a worktree", async () => {
  await mountNewSession({ branch: "feat/search", behind: 2 })
  await expect.element(switchButton()).toBeVisible()
  await choose("New worktree")
  await expect.element(switchButton()).not.toBeInTheDocument()
  await choose("Current checkout")
  await expect.element(switchButton()).toBeVisible()

  await sendText("go")
  await expect.element(page.getByRole("textbox", { name: "Message" })).toHaveValue("")
  await expect.element(switchButton()).not.toBeInTheDocument()
  await expect.element(page.getByRole("button", { name: /^Pull/ })).not.toBeInTheDocument()
})

const mountDeletedFolderSession = async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  const at = DateTime.makeUnsafe(0)
  server.worktrees.push({ path: "/p/.worktrees/docs-adr", branch: "docs/adr" })
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p/.worktrees/ivin-3f2a9c1e",
    inWorktree: true,
    branch: "ivin/3f2a9c1e",
    started: true,
    workingFolderDeleted: true,
    title: "Add the Working panel",
    harness: "claude",
    model: "sonnet",
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
  })
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

const continueHere = () =>
  page.getByRole("button", { name: /^(Continue here|Create and continue)$/ })

test("a session whose worktree was deleted shows the working folder picker instead of the text field", async () => {
  const server = await mountDeletedFolderSession()

  await expect.element(page.getByText("Where should the agent continue?")).toBeVisible()
  await expect.element(page.getByRole("textbox", { name: "Message" })).not.toBeInTheDocument()
  await expect
    .element(page.getByTestId("session-location"))
    .toHaveTextContent("Worktree deletedivin/3f2a9c1e")
  await expect.element(page.getByRole("radio", { name: /Current checkout/ })).toBeChecked()
  await expect.element(page.getByRole("radio", { name: /docs\/adr/ })).toBeVisible()

  await page.getByTestId("pick-working-folder").getByText("docs/adr").click()
  await continueHere().click()

  await expect.element(page.getByRole("textbox", { name: "Message" })).toBeVisible()
  expect(server.pickedFolders).toEqual([
    { kind: "existing_worktree", path: "/p/.worktrees/docs-adr" },
  ])
  await expect.element(page.getByTestId("session-location")).toHaveTextContent("Worktreedocs/adr")
})

test("the working folder picker is answered from the keyboard", async () => {
  const server = await mountDeletedFolderSession()

  await expect.element(page.getByRole("radio", { name: /Current checkout/ })).toHaveFocus()
  await userEvent.keyboard("{ArrowDown}")
  await expect.element(continueHere()).toHaveTextContent("Create and continue")
  await userEvent.keyboard("{Enter}")

  await expect.element(page.getByRole("textbox", { name: "Message" })).toBeVisible()
  expect(server.pickedFolders).toEqual([{ kind: "new_worktree" }])
})

test("a pick that fails says so beside the picker, keeps the choice and offers a retry", async () => {
  const server = await mountDeletedFolderSession()
  server.failNextCall("session.pickWorkingFolder")

  await page.getByTestId("pick-working-folder").getByText("docs/adr").click()
  await continueHere().click()

  await expect.element(page.getByTestId("pick-working-folder-alert")).toBeVisible()
  await expect.element(page.getByRole("radio", { name: /docs\/adr/ })).toBeChecked()
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("textbox", { name: "Message" })).toBeVisible()
})
