import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../packages/ui/src/app/host-components.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { SlotProps, ToolCallItem, UiContext } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const mount = async (item: ToolCallItem) => {
  let ToolCall!: ComponentType<SlotProps["transcript.toolCall"]>
  const ctx: UiContext = {
    pluginId: "tool-calls",
    slots: { add: (_slot, component) => void (ToolCall = component as typeof ToolCall) },
  }
  activate(ctx)
  const host = {
    useSession: () => undefined,
    useSessions: () => [],
    useTranscript: () => [],
    useAnswerApproval: () => async () => {},
    components: hostComponents,
  }
  await render(
    <UiHostProvider host={host}>
      <ToolCall item={item} sessionId="s1" />
    </UiHostProvider>,
  )
}

const tool = (status: ToolCallItem["status"], output: string | null): ToolCallItem => ({
  id: "i0",
  sessionId: "s1",
  position: 0,
  type: "tool_call",
  toolCallId: "t0",
  name: "Read",
  input: { path: "/a.ts" },
  status,
  output,
})

test("a tool call shows its name, input and result", async () => {
  await mount(tool("done", "file contents"))
  await expect.element(page.getByText("Read")).toBeVisible()
  await expect.element(page.getByText('{"path":"/a.ts"}')).toBeVisible()
  await expect.element(page.getByText("file contents")).toBeVisible()
})

test.each([
  ["running", "running"],
  ["done", "succeeded"],
  ["error", "failed"],
] as const)("a %s tool call reads %s", async (status, label) => {
  await mount(tool(status, status === "running" ? null : "out"))
  await expect.element(page.getByTestId("tool-status")).toHaveTextContent(label)
})

test("a long result is folded behind a preview", async () => {
  const text = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n")
  await mount(tool("done", text))
  const output = page.getByTestId("tool-output")
  await expect.element(output).toBeVisible()
  expect(output.element().querySelector("summary")?.textContent).toBe("line 0\nline 1\nline 2")
  const code = output.element().querySelector("pre")!
  expect(code.checkVisibility()).toBe(false)
  output.element().querySelector("summary")!.click()
  expect(code.checkVisibility()).toBe(true)
})
