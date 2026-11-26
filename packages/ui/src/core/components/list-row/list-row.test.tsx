import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { ListRow } from "./list-row.tsx"

test("a row with an href opens it in the browser when clicked", async () => {
  const opened: string[] = []
  const stop = (event: MouseEvent) => {
    event.preventDefault()
    const link = (event.target as Element).closest("a")
    if (link !== null) opened.push(`${link.target} ${link.href}`)
  }
  document.addEventListener("click", stop)
  try {
    await render(
      <ListRow title="Keep the return path" href="https://github.com/acme/shop/pull/12" />,
    )
    await page.getByRole("link", { name: "Keep the return path" }).click()
    expect(opened).toEqual(["_blank https://github.com/acme/shop/pull/12"])
  } finally {
    document.removeEventListener("click", stop)
  }
})
