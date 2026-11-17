import { RegistryProvider } from "@effect/atom-react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TranscriptView } from "./transcript-view.tsx"

const base = (position: number) => ({ id: `i${position}`, sessionId: "s1", position })

const show = async (items: ReadonlyArray<TranscriptItem>) => {
  const server = makeFakeServer()
  server.seedItems("s1", items)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height: 600 }}>
        <TranscriptView sessionId="s1" />
      </div>
    </RegistryProvider>,
  )
}

test("assistant messages render Markdown, user messages stay plain text", async () => {
  await show([
    { ...base(0), type: "message", role: "user", text: "**not bold**" },
    {
      ...base(1),
      type: "message",
      role: "assistant",
      text: "Some **bold** text\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |",
    },
  ])
  await expect.element(page.getByText("**not bold**")).toBeVisible()
  await expect.element(page.getByRole("listitem").first()).toHaveTextContent("one")
  await expect.element(page.getByText("bold", { exact: true })).toBeVisible()
  expect(document.querySelector("strong")?.textContent).toBe("You")
  expect([...document.querySelectorAll("strong")].map((e) => e.textContent)).toContain("bold")
  await expect.element(page.getByRole("table")).toBeVisible()
})

test("thinking is folded until opened", async () => {
  await show([{ ...base(0), type: "thinking", text: "secret reasoning" }])
  await expect.element(page.getByText("Thinking")).toBeVisible()
  const details = document.querySelector("details")!
  expect(details.open).toBe(false)
  await page.getByText("Thinking").click()
  expect(details.open).toBe(true)
  await expect.element(page.getByText("secret reasoning")).toBeVisible()
})

const tool = (
  status: "running" | "done" | "error",
  output: string | null,
  position = 0,
): TranscriptItem => ({
  ...base(position),
  type: "tool_call",
  toolCallId: `t${position}`,
  name: "Read",
  input: { path: "/a.ts" },
  status,
  output,
})

test("a tool call shows its name, input, result and state", async () => {
  await show([tool("running", null, 0), tool("done", "file contents", 1), tool("error", "boom", 2)])
  await expect.element(page.getByText("file contents")).toBeVisible()
  const statuses = document.querySelectorAll('[data-testid="tool-status"]')
  expect([...statuses].map((s) => s.textContent)).toEqual(["running", "succeeded", "failed"])
  await expect.element(page.getByText("file contents")).toBeVisible()
  await expect.element(page.getByText("boom")).toBeVisible()
  expect(document.body.textContent).toContain('{"path":"/a.ts"}')
})

test("a long tool result is folded behind a preview", async () => {
  const output = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")
  await show([tool("done", output)])
  await expect.element(page.getByTestId("tool-output")).toBeVisible()
  const details = document.querySelector<HTMLDetailsElement>('[data-testid="tool-output"]')!
  expect(details.open).toBe(false)
  expect(details.querySelector("summary")?.textContent).toBe("line 0\nline 1\nline 2")
  expect(details.querySelector("pre")?.checkVisibility()).toBe(false)
  details.open = true
  expect(details.querySelector("pre")?.checkVisibility()).toBe(true)
})

test("an error item is shown as an alert", async () => {
  await show([{ ...base(0), type: "error", message: "The run failed" }])
  await expect.element(page.getByRole("alert")).toHaveTextContent("The run failed")
})
