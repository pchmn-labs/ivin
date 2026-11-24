import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ListSection } from "../list-section/list-section.tsx"
import { EmptyMessage } from "./empty-message.tsx"

test("the message starts where a list section's label does", async () => {
  await render(
    <div>
      <ListSection label="Sessions" />
      <EmptyMessage>No sessions yet.</EmptyMessage>
    </div>,
  )
  const message = page.getByText("No sessions yet.").element()
  const label = page.getByText("Sessions", { exact: true }).element()
  const textStart = (element: Element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().left
  }
  expect(textStart(message)).toBe(textStart(label))
})
