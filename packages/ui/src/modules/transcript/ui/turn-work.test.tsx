import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ToolKind, TranscriptItem } from "@ivin/contracts/transcript"
import { builtinPlugins } from "../../../app/builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { TranscriptView } from "./transcript-view.tsx"

const items = (origin = 0) => {
  let position = 0
  const base = (id: string) => ({
    id,
    sessionId: "s1",
    position: position++,
    at: origin + position * 1000,
  })
  return {
    user: (id: string, text = id): TranscriptItem => ({
      ...base(id),
      type: "message",
      role: "user",
      text,
      images: [],
    }),
    text: (id: string, text = id): TranscriptItem => ({
      ...base(id),
      type: "message",
      role: "assistant",
      text,
      images: [],
    }),
    call: (
      id: string,
      kind: ToolKind = "command",
      status: "running" | "done" | "error" = "done",
    ): TranscriptItem => ({
      ...base(id),
      type: "tool_call",
      toolCallId: id,
      name: `tool-${id}`,
      kind,
      input: { command: `command ${id}` },
      status,
      output: status === "running" ? null : `output ${id}`,
    }),
    interruption: (id: string): TranscriptItem => ({ ...base(id), type: "interruption" }),
  }
}

const mount = async (seeded: TranscriptItem[], live = false, height = 600) => {
  const server = makeFakeServer()
  server.seedItems("s1", seeded)
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <div style={{ height }}>
        <PluginsProvider plugins={builtinPlugins}>
          <TranscriptView sessionId="s1" live={live} />
        </PluginsProvider>
      </div>
    </RegistryProvider>,
  )
  return server
}

const toolRows = () => document.querySelectorAll('[data-testid="turn"] [data-testid="tool-output"]')
const turnLine = () => page.getByTestId("turn-line")

test("a running turn stays unfolded, with its last step open and the steps before folded", async () => {
  const { user, text, call } = items(Date.now() - 20_000)
  await mount(
    [
      user("u1", "fix it"),
      text("t1", "Looking at the code"),
      call("c1", "read"),
      text("t2", "Running the tests"),
      call("c2", "command", "error"),
      call("c3", "command", "running"),
    ],
    true,
  )

  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  expect(turnLine().element().textContent).toMatch(/^Working for [12]\ds · 1 failed$/)
  await expect.element(page.getByText("Looking at the code")).toBeVisible()
  await expect.element(page.getByText("Running the tests")).toBeVisible()
  await expect.element(page.getByText("tool-c3")).toBeVisible()
  expect(toolRows()).toHaveLength(2)
  await expect
    .element(page.getByTestId("step-summary").nth(0))
    .toHaveAttribute("aria-expanded", "false")
})

test("a finished turn folds its work behind one line, and shows the user's message and the answer", async () => {
  const { user, text, call } = items()
  await mount([
    user("u1", "fix it"),
    text("t1", "Looking"),
    call("c1"),
    call("c2", "read", "error"),
    text("a", "Fixed it"),
  ])

  await expect.element(turnLine()).toHaveTextContent("Worked for 4s · 2 tool calls · 1 failed")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "false")
  await expect.element(page.getByText("fix it")).toBeVisible()
  await expect.element(page.getByText("Fixed it")).toBeVisible()
  expect(page.getByText("Looking").query()).toBeNull()
  expect(toolRows()).toHaveLength(0)
})

test("unfolded, each sentence heads a step with a summary of its calls", async () => {
  const { user, text, call } = items()
  await mount([
    user("u1"),
    call("c0", "search"),
    text("t1", "Reading the files"),
    call("c1"),
    call("c2"),
    call("c3", "read"),
    call("c4", "command", "error"),
    text("a", "Done"),
  ])

  await turnLine().click()

  const summaries = page.getByTestId("step-summary")
  await expect.element(summaries.nth(0)).toHaveTextContent("Searched")
  await expect
    .element(summaries.nth(1))
    .toHaveTextContent("Ran 3 commands · read 1 file · 1 failed")
  await expect.element(page.getByText("Reading the files")).toBeVisible()
  expect(toolRows()).toHaveLength(5)
  expect(page.getByTestId("turn-step").nth(1).element().hasAttribute("data-failed")).toBe(true)
})

test("a turn of 9 calls opens its steps folded, but for a failed call and a subagent call", async () => {
  const { user, text, call } = items()
  await mount([
    user("u1"),
    text("t1", "First"),
    ...["c1", "c2", "c3", "c4"].map((id) => call(id)),
    call("c5", "agent"),
    text("t2", "Second"),
    call("c6"),
    call("c7", "read", "error"),
    call("c8"),
    call("c9"),
    text("a", "Done"),
  ])

  await turnLine().click()

  await expect.element(page.getByText("tool-c5")).toBeVisible()
  await expect.element(page.getByText("tool-c7")).toBeVisible()
  expect(toolRows()).toHaveLength(2)
  await page.getByTestId("step-summary").nth(0).click()
  expect(toolRows()).toHaveLength(6)
})

test("a stopped turn stays unfolded and says it stopped", async () => {
  const { user, text, call, interruption } = items()
  await mount([user("u1"), text("t1", "Trying"), call("c1"), interruption("i")])

  await expect.element(turnLine()).toHaveTextContent("Stopped after 3s · 1 tool call")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  await expect.element(page.getByText("Trying")).toBeVisible()
})

test("the keyboard folds and unfolds the turn line and a step summary", async () => {
  const { user, text, call } = items()
  await mount([user("u1"), text("t1", "Step"), call("c1"), text("a", "Done")])

  await expect.element(turnLine()).toBeVisible()
  ;(turnLine().element() as HTMLElement).focus()
  await userEvent.keyboard("{Enter}")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "true")
  await expect.element(page.getByText("tool-c1")).toBeVisible()

  await userEvent.tab()
  await expect.element(page.getByTestId("step-summary")).toHaveFocus()
  await userEvent.keyboard(" ")
  await expect.element(page.getByTestId("step-summary")).toHaveAttribute("aria-expanded", "false")
  expect(toolRows()).toHaveLength(0)

  ;(turnLine().element() as HTMLElement).focus()
  await userEvent.keyboard(" ")
  await expect.element(turnLine()).toHaveAttribute("aria-expanded", "false")
})

test("unfolding the last turn does not scroll the transcript", async () => {
  const { user, text, call } = items()
  const turns = Array.from({ length: 6 }, (_, t) => [
    user(`u${t}`),
    text(`t${t}`, `Step ${t}`),
    ...Array.from({ length: 6 }, (_, c) => call(`c${t}-${c}`)),
    text(`a${t}`, `Answer ${t}`),
  ]).flat()
  await mount(turns, false, 300)
  const scroller = document.querySelector<HTMLElement>('[data-testid="transcript"]')!
  await expect.element(page.getByText("Answer 5")).toBeVisible()
  await vi.waitFor(() => {
    scroller.scrollTop = scroller.scrollHeight
    expect(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight).toBeLessThan(2)
  })
  const before = scroller.scrollTop

  await page.getByTestId("turn-line").last().click()
  await new Promise((resolve) => setTimeout(resolve, 300))

  expect(scroller.scrollTop).toBe(before)
})

test("a session of 200 turns of 30 calls scrolls without rendering the folded calls", async () => {
  const { user, text, call } = items()
  const turns = Array.from({ length: 200 }, (_, t) => [
    user(`u${t}`, `Question ${t}`),
    text(`t${t}`),
    ...Array.from({ length: 30 }, (_, c) => call(`c${t}-${c}`)),
    text(`a${t}`, `Answer ${t}`),
  ]).flat()
  await mount(turns, false, 400)
  const scroller = document.querySelector<HTMLElement>('[data-testid="transcript"]')!
  await expect.element(page.getByText("Answer 199")).toBeVisible()

  for (let i = 0; i < 10; i++) {
    scroller.scrollTop = 0
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(toolRows()).toHaveLength(0)
  }
  // Older pages load one after another, which outlasts the default second on CI.
  await vi.waitFor(() => expect(page.getByText("Answer 190").query()).not.toBeNull(), {
    timeout: 5_000,
  })
  expect(document.querySelectorAll('[data-testid="turn"]').length).toBeLessThan(20)
})
