import { defaultSettings } from "../../../packages/contracts/src/setting.ts"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { hostComponents } from "../../../packages/ui/src/app/host-components.ts"
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
    editorExtensions: { add: () => undefined },
    fileIcons: { add: () => undefined },
    fileUrl: (path) => path,
    sidebar: { showPanel: () => undefined },
  }
  activate(ctx)
  const host = {
    useSession: () => undefined,
    useSessions: () => [],
    useProjects: () => ({ projects: [], selectedPath: null }),
    useSelectedSessionId: () => null,
    useTabs: () => [],
    useOpenTab: () => () => {},
    useTranscript: () => [],
    useAnnotations: () => [],
    useAnswerApproval: () => async () => undefined,
    useAnswerQuestion: () => async () => undefined,
    useListFolder: () => async () => ({ kind: "listed" as const, entries: [] }),
    useOpenFile: () => async () => undefined,
    useListFiles: () => async () => ({ kind: "listed" as const, paths: [], truncated: false }),
    useFolderChanges: () => undefined,
    useGitStatus: () => [],
    useFileOnScreen: () => null,
    useChanges: () => ({ listing: { kind: "loading" as const }, retry: () => {} }),
    useOpenDiff: () => async () => undefined,
    useDiffOnScreen: () => null,
    useSettings: () => defaultSettings,
    useCommittedChanges: () => ({ listing: { kind: "loading" as const }, retry: () => {} }),
    useOpenCommittedDiff: () => async () => undefined,
    useCommittedDiffOnScreen: () => null,
    useDiscardChanges: () => async () => undefined,
    useSessionActions: () => ({ items: [], failure: null }),
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
  at: 0,
  type: "tool_call",
  toolCallId: "t0",
  name: "Read",
  kind: "read",
  input: { file_path: "/a.ts" },
  status,
  output,
})

test("a tool call shows its icon, name and input on one row, its result opening under it", async () => {
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
