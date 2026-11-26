import { RegistryProvider } from "@effect/atom-react"
import type { Harness, SessionStatus } from "@ivin/contracts/session"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { type FakeCheckout, makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SidebarTabs } from "../../../app/sidebar-tabs.tsx"
import { SessionView } from "./session-view.tsx"

// The composer's field is a contenteditable, whose lines innerText keeps.
const composerText = () =>
  (page.getByRole("textbox", { name: "Message" }).element() as HTMLElement).innerText

const mountSession = async (
  status: "idle" | "working" | "waiting",
  harness: Harness = "claude",
) => {
  const server = makeFakeServer()
  server.openProject("/p")
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "t", harness, status }))
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

test("opening a session puts the focus in its composer, after the draft's text", async () => {
  await mountSession("idle")
  const field = page.getByRole("textbox", { name: "Message" })
  await expect.element(field).toHaveFocus()
  await expect.element(field).toHaveAttribute("aria-placeholder", "Ask, build, or paste an image…")
})

test("opening a session that waits on an approval leaves the focus to the approval sheet", async () => {
  await mountSession("waiting")
  await expect.element(page.getByTestId("composer-session-status")).toBeInTheDocument()
  await expect.element(page.getByRole("textbox", { name: "Message" })).not.toHaveFocus()
})

const focusedTab = async (by: "keyboard" | "click") => {
  const tab = document.createElement("button")
  tab.setAttribute("role", "tab")
  tab.textContent = "Other session"
  document.body.append(tab)
  if (by === "click") await page.getByRole("tab", { name: "Other session" }).click()
  else {
    tab.focus()
    await userEvent.keyboard("{ArrowRight}")
  }
  return tab
}

test("opening a session from a tab reached by the keyboard keeps the focus on the tab", async () => {
  const tab = await focusedTab("keyboard")
  await mountSession("idle")
  await expect.element(page.getByTestId("composer-session-status")).toBeInTheDocument()
  expect(document.activeElement).toBe(tab)
  tab.remove()
})

test("opening a session from a clicked tab puts the focus in its composer", async () => {
  const tab = await focusedTab("click")
  await mountSession("idle")
  await expect.element(page.getByRole("textbox", { name: "Message" })).toHaveFocus()
  tab.remove()
})

test("the composer announces the status and follows the server", async () => {
  const server = await mountSession("idle")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
  server.setStatus("s1", "waiting")
  await expect
    .element(page.getByTestId("composer-session-status"))
    .toHaveTextContent("Waiting for you")
})

test("a message that fails to send stays in the composer, and Retry sends it", async () => {
  const server = await mountSession("idle")
  const send = server.holdNextSend()
  const field = page.getByRole("textbox", { name: "Message" })
  await field.fill("keep me")
  await page.getByRole("button", { name: "Send" }).click()
  await expect.poll(composerText).toBe("")

  send.fail()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByRole("button", { name: "Retry" })).toBeVisible()
  await expect.poll(composerText).toBe("keep me")
  expect(server.errorReports.map((report) => report.action)).toContain("session.sendMessage")

  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("keep me", { exact: true })).toBeVisible()
  await expect.poll(composerText).toBe("")
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
  await expect.poll(composerText).toBe("hello")
})

test.each(["the composer", "the page"])(
  "Escape interrupts a working session whether the focus is in %s",
  async (focus) => {
    await mountSession("working")
    if (focus === "the composer") await page.getByRole("textbox", { name: "Message" }).click()
    await userEvent.keyboard("{Escape}")
    await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
  },
)

test("a pending approval shows a sheet on the composer that Enter allows, leaving no record", async () => {
  const server = await mountSession("waiting")
  server.pushItem({
    id: "a0",
    sessionId: "s1",
    position: 0,
    at: 0,
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
  await expect.element(page.getByTestId("turn")).toBeInTheDocument()
  expect(page.getByTestId("approval-decision").query()).toBeNull()
  expect(page.getByTestId("turn").getByText("git push").query()).toBeNull()
})

const pushApproval = (server: Awaited<ReturnType<typeof mountSession>>) =>
  server.pushItem({
    id: "a0",
    sessionId: "s1",
    position: 0,
    at: 0,
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
  expect(server.callsOf("session.answerApproval")).toBe(0)
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
  await expect.poll(composerText).toBe("one\ntwo")
  await page.getByRole("button", { name: "Send" }).hover()
  await expect.element(page.getByText(/^Send \((⌘|Ctrl\+)Enter\)$/)).toBeVisible()

  await field.click()
  await userEvent.keyboard(`{${mod}>}{Enter}{/${mod}}`)
  await expect.poll(composerText).toBe("")
  await expect.element(page.getByTestId("transcript-item")).toBeVisible()
})

test("Shift+Enter in the composer inserts a new line and does not send", async () => {
  await mountSession("idle")
  const field = page.getByRole("textbox", { name: "Message" })
  await field.click()
  await userEvent.keyboard("one{Shift>}{Enter}{/Shift}two")
  await expect.poll(composerText).toBe("one\ntwo")
})

test.each([
  ["a rename input cancels the rename", "textbox", "Session title"],
  ["an open menu closes it", "menuitem", "Rename"],
] as const)("Escape in %s without interrupting the session", async (_, role, name) => {
  const server = makeFakeServer()
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "t", status: "working" }))
  server.openProject("/p")
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <SidebarTabs />
        <SessionView projectPath="/p" sessionId="s1" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  await page.getByTestId("session-item").hover()
  await page.getByRole("button", { name: "Session actions" }).click()
  if (role === "textbox") await page.getByRole("menuitem", { name: "Rename" }).click()
  await expect.element(page.getByRole(role, { name })).toBeVisible()
  await userEvent.keyboard("{Escape}")
  await expect.element(page.getByRole(role, { name })).not.toBeInTheDocument()
  expect(server.callsOf("session.interrupt")).toBe(0)
  expect(server.sessions.get("s1")?.status).toBe("working")
})

test("Enter on the focused Interrupt button presses it rather than running composer.send", async () => {
  await mountSession("working")
  page.getByRole("button", { name: "Interrupt" }).element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
})

const mountNewSession = async (checkout: Partial<FakeCheckout> = {}) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  Object.assign(server.checkout, checkout)
  const session = makeTestSession({ id: "s1", title: "New session", started: false })
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

test("a worktree list git cannot read shows a message with a retry in the working folder menu", async () => {
  const server = await mountNewSession()
  server.failListingWith("fatal: detected dubious ownership")
  await picker().click()

  await expect
    .element(page.getByText(/^ivin could not list this project's worktrees\./))
    .toBeVisible()
  server.failListingWith(null)
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("Existing worktrees")).toBeVisible()
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

test("a worktree git cannot create shows git's message in the transcript and keeps the message and the choice", async () => {
  const server = await mountNewSession()
  server.failWorktreeWith("fatal: unable to access 'origin': Could not resolve host")
  await choose("New worktree")
  await sendText("go")

  const alert = page.getByTestId("composer-alert")
  await vi.waitFor(() => expect(alert.query()).not.toBeNull())
  await expect.element(alert).toBeVisible()
  expect(alert.element().textContent).toMatch(/^The worktree was not created/)
  await expect
    .element(
      page.getByText("fatal: unable to access 'origin': Could not resolve host", { exact: true }),
    )
    .toBeVisible()
  await expect.poll(composerText).toBe("go")
  expect(picker().element().textContent).toBe("New worktree")
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

const mountDeletedFolderSession = async ({
  extraWorktrees = 0,
  status = "idle",
}: { extraWorktrees?: number; status?: SessionStatus } = {}) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "shop", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.worktrees.push({ path: "/p/.worktrees/docs-adr", branch: "docs/adr" })
  for (let n = 0; n < extraWorktrees; n++) {
    server.worktrees.push({ path: `/p/.worktrees/feat-${n}`, branch: `feat/${n}` })
  }
  server.sessions.set(
    "s1",
    makeTestSession({
      id: "s1",
      workingFolder: "/p/.worktrees/ivin-3f2a9c1e",
      inWorktree: true,
      branch: "ivin/3f2a9c1e",
      workingFolderDeleted: true,
      title: "Add the Working panel",
      status,
    }),
  )
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <div style={{ display: "flex", flexDirection: "column", height: 600, overflow: "hidden" }}>
          <SessionView projectPath="/p" sessionId="s1" />
        </div>
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

test("a working session whose worktree was deleted keeps its composer, and offers the picker once it stops", async () => {
  const server = await mountDeletedFolderSession({ status: "working" })

  await expect.element(page.getByRole("textbox", { name: "Message" })).toBeVisible()
  await expect.element(page.getByText("Where should the agent continue?")).not.toBeInTheDocument()
  await expect
    .element(page.getByTestId("session-location"))
    .toHaveTextContent("Worktree deletedivin/3f2a9c1e")

  server.setStatus("s1", "idle")

  await expect.element(page.getByText("Where should the agent continue?")).toBeVisible()
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

test("a working folder picker with many worktrees scrolls its list in a short window and leaves the window still", async () => {
  await mountDeletedFolderSession({ extraWorktrees: 30 })

  await expect.element(page.getByRole("radio", { name: /feat\/29/ })).toBeInTheDocument()
  expect(continueHere().element().getBoundingClientRect().bottom).toBeLessThanOrEqual(600)
  const root = document.scrollingElement!
  expect(root.scrollHeight).toBe(root.clientHeight)
  const list = page.getByRole("group", { name: "Working folder" }).element()
  expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)

  page
    .getByRole("radio", { name: /Current checkout/ })
    .element()
    .focus()
  for (let n = 0; n < 6; n++) await userEvent.keyboard("{ArrowDown}")
  await expect.element(page.getByRole("radio", { name: /feat\/3\b/ })).toBeChecked()
  const chosen = page.getByTestId("pick-working-folder").getByText("feat/3", { exact: true })
  const row = chosen.element().closest("label")!.getBoundingClientRect()
  const view = list.getBoundingClientRect()
  expect(row.top).toBeGreaterThanOrEqual(view.top)
  expect(row.bottom).toBeLessThanOrEqual(view.bottom)
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

const runOptions = (name: string) => page.getByRole("button", { name: `Run options: ${name}` })

test("a model that does not take the current effort moves it down, and greys out what it does not take", async () => {
  const server = await mountSession("idle")
  await runOptions("Sonnet 5.5, High, Manual").click()
  await page.getByTestId("run-option-effort-xhigh").click()
  await vi.waitFor(() => expect(server.sessions.get("s1")?.effort).toBe("xhigh"))
  await page.getByTestId("run-option-model-claude-opus-4-6").click()

  await vi.waitFor(() =>
    expect(server.sessions.get("s1")).toMatchObject({ model: "claude-opus-4-6", effort: "high" }),
  )
  await expect
    .element(page.getByTestId("run-option-effort-xhigh"))
    .toHaveAttribute("aria-disabled", "true")
})

test("keyboard only: open the menu, move to the effort column, pick low, and close back on the button", async () => {
  const server = await mountSession("idle")
  const trigger = runOptions("Sonnet 5.5, High, Manual")
  trigger.element().focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(page.getByTestId("run-option-effort-low")).toBeVisible()
  await userEvent.keyboard("{ArrowRight}{Home}{Enter}")

  await vi.waitFor(() => expect(server.sessions.get("s1")?.effort).toBe("low"))
  await userEvent.keyboard("{Escape}")
  await expect.element(runOptions("Sonnet 5.5, Low, Manual")).toHaveFocus()
})

test("each permission mode shows its description under its name, and models show none", async () => {
  await mountSession("idle")
  await runOptions("Sonnet 5.5, High, Manual").click()
  await expect
    .element(page.getByTestId("run-option-permissionMode-plan"))
    .toHaveAccessibleDescription("Reads and plans, changes nothing")
  await expect.element(page.getByText("For everyday tasks")).not.toBeInTheDocument()
})

test("a failed relaunch docks a sheet above the composer, puts the message back and offers the previous model", async () => {
  const server = await mountSession("idle")
  await runOptions("Sonnet 5.5, High, Manual").click()
  await page.getByTestId("run-option-model-haiku").click()
  await vi.waitFor(() => expect(server.sessions.get("s1")?.model).toBe("haiku"))
  await userEvent.keyboard("{Escape}")

  server.failRelaunch("s1", {
    previous: { model: "sonnet", effort: "high", permissionMode: "manual" },
    message: "fix the tests",
    error: "There's an issue with the selected model",
  })

  const sheet = page.getByTestId("composer-relaunch-failure")
  await expect.element(sheet.getByText("There's an issue with the selected model")).toBeVisible()
  await expect.element(sheet).toHaveAttribute("role", "alert")
  await vi.waitFor(() =>
    expect(sheet.element().textContent).toContain("The agent did not start with Haiku 5.5."),
  )
  await vi.waitFor(() => expect(composerText()).toBe("fix the tests"))

  await sheet.getByRole("button", { name: "Pick another" }).click()
  await expect.element(page.getByRole("listbox", { name: "Model" })).toBeVisible()
  await userEvent.keyboard("{Escape}")

  await sheet.getByRole("button", { name: "Back to Sonnet 5.5" }).click()
  await expect.element(runOptions("Sonnet 5.5, High, Manual")).toBeVisible()
  await expect.element(sheet).not.toBeInTheDocument()
  await vi.waitFor(() => expect(composerText()).toBe("fix the tests"))
})

test("a model change the server did not take goes back, says so above the composer and retries", async () => {
  const server = await mountSession("idle")
  server.failNextCall("session.setRunOptions")
  await runOptions("Sonnet 5.5, High, Manual").click()
  await page.getByTestId("run-option-model-opus").click()
  await userEvent.keyboard("{Escape}")

  const alert = page.getByTestId("composer-alert")
  await vi.waitFor(() =>
    expect(alert.element().textContent).toContain("The model was not changed."),
  )
  await expect.element(runOptions("Sonnet 5.5, High, Manual")).toBeVisible()

  await alert.getByRole("button", { name: "Retry" }).click()
  await vi.waitFor(() => expect(server.sessions.get("s1")?.model).toBe("opus"))
  await expect.element(alert).not.toBeInTheDocument()
})

test("stopping the agent before it read the messages sent while it worked puts them back in the empty composer", async () => {
  const server = await mountSession("working")
  await page.getByRole("textbox").fill("also check the logs")
  await userEvent.keyboard("{Enter}")
  await vi.waitFor(() => expect(server.sessions.get("s1")?.pendingMessages).toHaveLength(1))
  await page.getByRole("textbox").fill("and the config")
  await userEvent.keyboard("{Enter}")
  await vi.waitFor(() => expect(server.sessions.get("s1")?.pendingMessages).toHaveLength(2))
  await vi.waitFor(() => expect(composerText()).toBe(""))

  await page.getByRole("button", { name: "Interrupt" }).click()

  await vi.waitFor(() => expect(composerText()).toBe("also check the logs\n\nand the config"))
})

test("messages sent while the agent works wait in a sheet on the composer, and Send now starts a turn with them", async () => {
  const server = await mountSession("working")
  await page.getByRole("textbox").fill("also check the logs")
  await userEvent.keyboard("{Enter}")
  await page.getByRole("textbox").fill("and the config")
  await userEvent.keyboard("{Enter}")

  const sheet = page.getByTestId("composer-pending")
  await expect.element(sheet.getByText("2 messages sent to the agent")).toBeVisible()
  await expect.element(sheet.getByText("also check the logs")).toBeVisible()
  await expect.element(sheet.getByText("and the config")).toBeVisible()

  await sheet.getByRole("button", { name: "Send now" }).click()

  await expect.element(sheet).not.toBeInTheDocument()
  // The view scrolls to the last message sent, which pushes the first one above it.
  await expect.element(page.getByText("and the config")).toBeVisible()
  await vi.waitFor(() => expect(server.sessions.get("s1")?.pendingMessages).toEqual([]))
})

test("unread messages come back after a draft the user typed in the meantime, and a message of images alone still shows in the sheet", async () => {
  const server = await mountSession("working")
  const pending = [
    { id: "p1", text: "also check the logs", images: [] },
    { id: "p2", text: "", images: [{ id: "img-1", number: 1, mediaType: "image/png" as const }] },
  ]
  server.sessions.set("s1", { ...server.sessions.get("s1")!, pendingMessages: pending })
  server.setStatus("s1", "waiting")
  await expect.element(page.getByTestId("composer-pending").getByText("[Image #1]")).toBeVisible()
  await page.getByRole("textbox").fill("one more thing")

  server.sessions.set("s1", {
    ...server.sessions.get("s1")!,
    pendingMessages: [],
    unreadMessages: [pending[0]!],
  })
  server.setStatus("s1", "idle")

  await vi.waitFor(() => expect(composerText()).toBe("one more thing\n\nalso check the logs"))
})
