import { lazy } from "react"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { LazyOnOpen } from "./lazy-on-open.tsx"

const slow = (() => {
  let release = () => {}
  const Late = lazy(
    () =>
      new Promise<{ default: () => React.JSX.Element }>((resolve) => {
        release = () => resolve({ default: () => <p>Loaded</p> })
      }),
  )
  return { Late, release: () => release() }
})()

test("nothing is drawn or loaded while closed", async () => {
  const { container } = await render(
    <LazyOnOpen open={false}>
      <slow.Late />
    </LazyOnOpen>,
  )
  expect(container.innerHTML).toBe("")
})

test("a loading indicator shows while the code loads, then the content", async () => {
  await render(
    <LazyOnOpen open>
      <slow.Late />
    </LazyOnOpen>,
  )
  await expect.element(page.getByRole("status", { name: "Loading" })).toBeVisible()
  slow.release()
  await expect.element(page.getByText("Loaded")).toBeVisible()
  await expect.element(page.getByRole("status", { name: "Loading" })).not.toBeInTheDocument()
})
