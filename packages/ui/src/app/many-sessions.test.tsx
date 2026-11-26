import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { mountApp } from "./test-app.tsx"

const PROJECT = "northwind-industries-holdings-customer-portal-monorepo-with-a-very-long-name"
const LONG_TITLE =
  "Fix the Wiśniewska-Kowalczyk invoice export so that bartholomew.fitzgerald@northwind-industries-holdings.example.com stops getting duplicates"
const LONG_BRANCH =
  "feat/1284-aleksandra-wisniewska-kowalczyk-invoice-export-duplicates-for-northwind-holdings"
const titles = [LONG_TITLE, "Jo", "😀🚀"]

const mountMany = async (count: number) => {
  await page.viewport(900, 700)
  const server = makeFakeServer({
    project: {
      path: `/dev/${PROJECT}`,
      name: PROJECT,
      lastOpenedAt: DateTime.makeUnsafe(0),
    },
  })
  for (let n = 0; n < count; n++) {
    server.sessions.set(
      `s${n}`,
      makeTestSession({
        id: `s${n}`,
        title: titles[n % titles.length]!,
        projectPath: `/dev/${PROJECT}`,
        inWorktree: n % 2 === 0,
        branch: LONG_BRANCH,
      }),
    )
    server.openTab(`s${n}`)
  }
  await mountApp(server)
  await expect.element(page.getByTestId("project-name")).toBeVisible()
  await expect.element(page.getByTestId("session-item").first()).toBeVisible()
}

test(
  "a session picked in a list of 60 brings its tab into view in the bar",
  // Rendering the rows and tabs in development React is slow on the CI runner.
  { timeout: 15_000 },
  async () => {
    await mountMany(60)
    const row = page.getByRole("button", { name: /Jo/ }).nth(15)
    expect(row.element().closest("ul")!.scrollHeight).toBeGreaterThan(window.innerHeight)
    row.element().scrollIntoView()
    await row.click()

    const selected = page
      .getByRole("tablist", { name: "Open sessions" })
      .getByRole("tab", { selected: true })
    await expect.element(selected).toBeVisible()
    await expect
      .poll(() => {
        const box = selected.element().getBoundingClientRect()
        return box.left >= 0 && box.right <= window.innerWidth
      })
      .toBe(true)
  },
)

test("a message of long unbroken lines keeps the Send button inside the window", async () => {
  await mountMany(3)
  await page.getByRole("button", { name: /Jo/ }).first().click()
  const field = page.getByRole("textbox", { name: "Message" })
  await field.click()
  const text = Array.from({ length: 50 }, (_, n) => `line ${n} ${"x".repeat(300)}`).join("\n")
  const data = new DataTransfer()
  data.setData("text/plain", text)
  field
    .element()
    .dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    )
  await expect.poll(() => (field.element() as HTMLElement).innerText.length).toBeGreaterThan(1000)

  await expect.element(page.getByRole("button", { name: "Send" })).toBeInViewport()
})

test("a project name of 80 characters is cut inside the sidebar card", async () => {
  await mountMany(1)
  const name = page.getByTestId("project-name").element()
  const card = page.getByRole("complementary").element().getBoundingClientRect()
  expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(card.right)
  expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
})
