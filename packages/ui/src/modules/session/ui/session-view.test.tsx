import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
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
    title: "t",
    model: "sonnet",
    status: "idle",
    createdAt: at,
    lastActivityAt: at,
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

const mountSession = async (status: "idle" | "working" | "waiting") => {
  const server = makeFakeServer()
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: true,
    title: "t",
    model: "sonnet",
    status,
    createdAt: at,
    lastActivityAt: at,
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
    title: "t",
    model: "sonnet",
    status: "working",
    createdAt: at,
    lastActivityAt: at,
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
    title: "t",
    model: "sonnet",
    status: "working",
    createdAt: at,
    lastActivityAt: at,
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

const mountNewSession = async () => {
  const server = makeFakeServer()
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: "/p",
    workingFolder: "/p",
    inWorktree: false,
    branch: "main",
    started: false,
    title: "New session",
    model: "sonnet",
    status: "idle",
    createdAt: at,
    lastActivityAt: at,
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

test("the working folder choice and branch name show only before the first message", async () => {
  const server = await mountNewSession()
  const choice = page.getByRole("combobox", { name: "Working folder" })
  await expect.element(choice).toHaveValue("checkout")
  expect(page.getByRole("textbox", { name: "Branch name" }).query()).toBeNull()
  await expect.element(page.getByTestId("session-location")).toHaveTextContent("Checkoutmain")

  await choice.selectOptions("worktree")
  await page.getByRole("textbox", { name: "Branch name" }).fill("feat/login")
  await page.getByRole("textbox", { name: "Message" }).fill("go")
  await page.getByRole("button", { name: "Send" }).click()

  await expect.element(choice).not.toBeInTheDocument()
  await expect.element(page.getByRole("textbox", { name: "Branch name" })).not.toBeInTheDocument()
  await expect.element(page.getByTestId("session-location")).toHaveTextContent("Worktreefeat/login")
  expect(server.sentMessages.map((m) => m.workingFolder)).toEqual([
    { kind: "worktree", branch: "feat/login" },
  ])
})

test("an empty branch name lets the server generate one, and the checkout sends no branch", async () => {
  const server = await mountNewSession()
  await page.getByRole("combobox", { name: "Working folder" }).selectOptions("worktree")
  await page.getByRole("textbox", { name: "Message" }).fill("go")
  await page.getByRole("button", { name: "Send" }).click()
  await expect
    .element(page.getByRole("combobox", { name: "Working folder" }))
    .not.toBeInTheDocument()
  await page.getByRole("textbox", { name: "Message" }).fill("again")
  await page.getByRole("button", { name: "Send" }).click()

  await vi.waitFor(() => expect(server.sentMessages).toHaveLength(2))
  expect(server.sentMessages.map((m) => m.workingFolder)).toEqual([
    { kind: "worktree", branch: null },
    undefined,
  ])
})

test("a worktree git cannot create shows git's message and keeps the message and the choice", async () => {
  const server = await mountNewSession()
  server.failWorktreeWith("fatal: a branch named 'taken' already exists")
  await page.getByRole("combobox", { name: "Working folder" }).selectOptions("worktree")
  await page.getByRole("textbox", { name: "Branch name" }).fill("taken")
  await page.getByRole("textbox", { name: "Message" }).fill("go")
  await page.getByRole("button", { name: "Send" }).click()

  const alert = page.getByTestId("composer-alert")
  await expect.element(alert).toBeVisible()
  expect(alert.element().textContent).toMatch(/^The worktree was not created/)
  expect(alert.element().textContent).toMatch(/fatal: a branch named 'taken' already exists$/)
  await expect.element(page.getByRole("textbox", { name: "Message" })).toHaveValue("go")
  await expect.element(page.getByRole("textbox", { name: "Branch name" })).toHaveValue("taken")
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
