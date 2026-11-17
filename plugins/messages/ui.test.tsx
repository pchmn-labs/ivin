import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import type { ComponentType } from "react"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { SlotProps, UiContext } from "@ivin/plugin-api/ui"
import { Markdown } from "../../packages/ui/src/modules/transcript/ui/markdown.tsx"
import { activate } from "./ui.tsx"

const mount = async (item: SlotProps["transcript.message"]["item"]) => {
  let Message!: ComponentType<SlotProps["transcript.message"]>
  const ctx: UiContext = {
    pluginId: "messages",
    slots: { add: (_slot, component) => void (Message = component as typeof Message) },
  }
  activate(ctx)
  const host = {
    useSession: () => undefined,
    useSessions: () => [],
    useTranscript: () => [],
    Markdown,
  }
  await render(
    <UiHostProvider host={host}>
      <Message item={item} sessionId="s1" />
    </UiHostProvider>,
  )
}

const base = { id: "i0", sessionId: "s1", position: 0 }

test("an assistant message renders Markdown", async () => {
  await mount({
    ...base,
    type: "message",
    role: "assistant",
    text: "Some **bold** text\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |",
  })
  await expect.element(page.getByText("bold", { exact: true })).toBeVisible()
  expect(document.querySelector("strong + strong, p strong")?.textContent).toBe("bold")
  await expect.element(page.getByRole("listitem").first()).toHaveTextContent("one")
  await expect.element(page.getByRole("table")).toBeVisible()
})

test("a user message stays plain text", async () => {
  await mount({ ...base, type: "message", role: "user", text: "**not bold**" })
  await expect.element(page.getByText("**not bold**")).toBeVisible()
})

test("thinking is folded until opened", async () => {
  await mount({ ...base, type: "thinking", text: "secret reasoning" })
  await expect.element(page.getByText("Thinking")).toBeVisible()
  const details = document.querySelector("details")!
  expect(details.open).toBe(false)
  await page.getByText("Thinking").click()
  expect(details.open).toBe(true)
  await expect.element(page.getByText("secret reasoning")).toBeVisible()
})

test("an error item is shown as an alert", async () => {
  await mount({ ...base, type: "error", message: "The run failed" })
  await expect.element(page.getByRole("alert")).toHaveTextContent("The run failed")
})
