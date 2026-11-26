import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { activatePlugin } from "../../../packages/ui/src/app/test-plugin-mount.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { TaskItem, ToolCallItem, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const mount = async (item: ToolCallItem, overrides: Partial<UiHost> = {}) => {
  const ToolCall = activatePlugin(activate, "tool-calls")("transcript.toolCall")
  const host: UiHost = {
    ...testUiHost,
    ...overrides,
    components: {
      ...testUiHost.components,
      FilePath: ({ path }: { path: string }) => <a href={path}>{path}</a>,
      TaskRun: ({ taskId, preview }) => <p>{`run ${taskId}${preview ? " preview" : ""}`}</p>,
    },
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
  at: 0,
  type: "tool_call",
  toolCallId: "t0",
  name: "Read",
  kind: "read",
  input: { file_path: "/a.ts" },
  status,
  output,
})

test("a tool call's result stays folded under its row until the row is clicked", async () => {
  await mount(tool("done", "file contents"))
  await expect.element(page.getByText("file contents")).not.toBeInTheDocument()
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
  await expect.element(page.getByText("ls")).toBeVisible()
  expect(
    page.getByText("ls").element().closest("summary")?.querySelector('[data-testid="tool-status"]'),
  ).toBeNull()
})

test("a tool without a main argument shows its full input in the folded details", async () => {
  await mount({ ...tool("done", "out"), name: "Custom", input: { a: 1 } })
  await page.getByText("Custom").click()
  await expect.element(page.getByText(/"a": 1/)).toBeVisible()
})

test("a skill call names its skill on a row that does not open, unless it failed", async () => {
  const skill = {
    ...tool("done", "Launching skill: implement"),
    name: "Skill",
    kind: "skill" as const,
  }
  await mount({ ...skill, input: { skill: "implement", args: "#122" } })
  await expect.element(page.getByText("/implement #122")).toBeVisible()
  expect(page.getByText("/implement #122").element().closest("details")).toBeNull()
  await mount({
    ...skill,
    id: "i1",
    status: "error",
    output: "Unknown skill",
    input: { skill: "nope" },
  })
  await page.getByText("/nope").click()
  await expect.element(page.getByText("Unknown skill")).toBeVisible()
})

test("the file a tool reads or writes is a link to it on the row", async () => {
  await mount(tool("done", "file contents"))
  await expect.element(page.getByRole("link", { name: "/a.ts" })).toBeVisible()
  await mount({ ...tool("done", "out"), id: "i1", name: "Bash", input: { command: "ls" } })
  await expect.element(page.getByRole("link", { name: "ls" })).not.toBeInTheDocument()
})

test("a subagent the turn waited for shows its run under its row, and Details opens the whole run", async () => {
  const opened: unknown[] = []
  const run: TaskItem = {
    id: "i3",
    sessionId: "s1",
    position: 0,
    at: 0,
    type: "task",
    taskId: "t0",
    toolCallId: "t0",
    kind: "agent",
    description: "Review the branch",
    status: "completed",
    summary: null,
    output: null,
  }
  await mount(
    {
      ...tool("done", "This agent's report was delivered to you as a message"),
      id: "i3",
      name: "Agent",
      kind: "agent",
      input: { description: "Review the branch", prompt: "Review it" },
    },
    {
      useTask: () => run,
      useOpenView: () => async (_sessionId, view, params) => void opened.push({ view, params }),
    },
  )
  await page.getByText("Review the branch").click()
  await expect.element(page.getByText("run t0 preview")).toBeVisible()
  await expect.element(page.getByText("This agent's report")).not.toBeInTheDocument()
  await page.getByTestId("agent-details").click()
  expect(opened).toEqual([
    {
      view: "tool-calls/task",
      params: { taskId: "t0", kind: "agent", description: "Review the branch" },
    },
  ])
})
