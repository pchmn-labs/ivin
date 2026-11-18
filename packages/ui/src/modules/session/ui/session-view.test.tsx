import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { selectedSessionIdAtom } from "../atoms/selected-session.ts"
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
    title: "t",
    model: "sonnet",
    status: "idle",
    createdAt: at,
    lastActivityAt: at,
  })

  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [selectedSessionIdAtom, "s1"],
      ]}
    >
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" />
      </PluginsProvider>
    </RegistryProvider>,
  )

  await expect.element(page.getByText("hello", { exact: true })).toBeVisible()
  await expect.element(page.getByTestId("tool-status")).toHaveTextContent("succeeded")
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
    title: "t",
    model: "sonnet",
    status,
    createdAt: at,
    lastActivityAt: at,
  })
  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [selectedSessionIdAtom, "s1"],
      ]}
    >
      <PluginsProvider plugins={builtinPlugins}>
        <SessionView projectPath="/p" />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

test("the status shows above the composer and follows the server", async () => {
  const server = await mountSession("idle")
  await expect.element(page.getByTestId("composer-session-status")).toHaveTextContent("Idle")
  server.setStatus("s1", "waiting")
  await expect
    .element(page.getByTestId("composer-session-status"))
    .toHaveTextContent("Waiting for you")
})

test("the Interrupt button shows only while the session works and interrupts it", async () => {
  const server = await mountSession("idle")
  await expect.element(page.getByTestId("composer-session-status")).toBeVisible()
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
  await vi.waitFor(() => expect(server.sessions.get("s1")?.title).toBe("also this"))
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
    title: "t",
    model: "sonnet",
    status: "working",
    createdAt: at,
    lastActivityAt: at,
  })
  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [selectedSessionIdAtom, "s1"],
      ]}
    >
      <PluginsProvider plugins={builtinPlugins}>
        <SessionList projectPath="/p" projectName="p" />
        <SessionView projectPath="/p" />
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

test("a pending approval shows a sheet on the composer that Enter answers, leaving a record", async () => {
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
  await expect.element(page.getByTestId("approval-decision")).toHaveTextContent("Allowed: git push")
})
