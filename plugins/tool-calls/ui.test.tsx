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
    commands: { register: () => undefined },
    keybindings: { add: () => undefined },
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
  input: { file_path: "/a.ts" },
  status,
  output,
})

test("a tool call shows its icon, name and input on one row, its result behind the chevron", async () => {
  await mount(tool("done", "file contents"))
  const row = page.getByTestId("tool-output").element().querySelector("summary")!
  expect(row.textContent).toBe("Read/a.ts")
  await expect.element(page.getByText("file contents")).not.toBeVisible()
  await page.getByText("Read").click()
  await expect.element(page.getByText("file contents")).toBeVisible()
})

test("a running tool call shows a spinner, a failed one says so, a finished one shows nothing", async () => {
  await mount(tool("running", null))
  await expect
    .element(page.getByTestId("tool-status").getByRole("img", { name: "running" }))
    .toBeVisible()
  await mount({ ...tool("error", "boom"), id: "i1" })
  await expect.element(page.getByText("failed")).toBeVisible()
  await mount({ ...tool("done", "out"), id: "i2", name: "Bash", input: { command: "ls" } })
  expect(
    page.getByText("ls").element().closest("summary")?.querySelector('[data-testid="tool-status"]'),
  ).toBeNull()
})

test("a tool without a main argument shows its full input in the folded details", async () => {
  await mount({ ...tool("done", "out"), name: "Custom", input: { a: 1 } })
  await page.getByText("Custom").click()
  await expect.element(page.getByText(/"a": 1/)).toBeVisible()
})
