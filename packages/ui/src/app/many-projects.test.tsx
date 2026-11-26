import { defaultSettings } from "@ivin/contracts/setting"
import { afterEach, expect, test } from "vitest"
import { page, userEvent } from "vitest/browser"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { mountApp } from "./test-app.tsx"

const COUNT = 40
const longName = (n: number) =>
  `northwind-industries-holdings-customer-portal-monorepo-with-a-very-long-name-${n}`
const names = Array.from({ length: COUNT }, (_, n) => longName(n))
const FIRST = longName(0)
const LAST = longName(COUNT - 1)
const STEPS = 5
const ONE_LINE = 40
const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"

afterEach(() => document.getElementById("root")?.remove())

const mountMany = async (layout: "rail" | "strip") => {
  const server = makeFakeServer()
  server.setUserSettings({ settings: { ...defaultSettings, sidebar: { layout } }, problem: null })
  for (const name of names) server.openProject(`/dev/${name}`)
  await page.viewport(900, 600)
  // base.css sizes the window through #root; the test container has no such id.
  const root = document.body.appendChild(document.createElement("div"))
  root.id = "root"
  await mountApp(server, { container: root })
  await expect.element(page.getByTestId("project-name")).toHaveTextContent(names.at(-1))
}

const inside = (inner: DOMRect, outer: DOMRect) =>
  inner.top >= outer.top - 1 &&
  inner.bottom <= outer.bottom + 1 &&
  inner.left >= outer.left - 1 &&
  inner.right <= outer.right + 1

const selectedInView = (row: Element) =>
  inside(
    row.querySelector('[aria-current="true"]')!.getBoundingClientRect(),
    row.getBoundingClientRect(),
  )

const noPageOverflow = () => {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
}

test("in the rail, many projects scroll inside the rail and the long name stays on one line in the header", async () => {
  await mountMany("rail")
  const rail = page.getByRole("navigation", { name: "Projects" })
  await expect.element(rail).toBeVisible()

  await expect.poll(() => rail.element().scrollHeight > rail.element().clientHeight).toBe(true)
  expect(getComputedStyle(rail.element()).overflowY).toBe("auto")
  noPageOverflow()
  const name = page.getByTestId("project-name").element()
  expect(name.scrollWidth).toBeGreaterThan(name.clientWidth)
  expect(name.getBoundingClientRect().height).toBeLessThan(ONE_LINE)

  const first = rail.getByRole("button", { name: names[0]!, exact: true })
  await first.click()
  await expect.element(page.getByTestId("project-name")).toHaveTextContent(names[0])
  await expect.element(first).toHaveAttribute("aria-current", "true")
})

test("in the rail, the button to open a folder can be reached after the last project", async () => {
  await mountMany("rail")
  const rail = page.getByRole("navigation", { name: "Projects" })
  const open = rail.getByRole("button", { name: "Open folder…" })
  rail.element().scrollTop = rail.element().scrollHeight
  await expect
    .poll(() =>
      inside(open.element().getBoundingClientRect(), rail.element().getBoundingClientRect()),
    )
    .toBe(true)
})

test("in the strip, many projects scroll sideways, and the selected one stays in view when stepping by key", async () => {
  await mountMany("strip")
  const row = page.getByRole("group", { name: "Projects" })
  await expect.element(row).toBeVisible()
  expect(row.element().scrollWidth).toBeGreaterThan(row.element().clientWidth)
  noPageOverflow()

  await expect.poll(() => selectedInView(row.element())).toBe(true)

  for (let step = 0; step < STEPS; step++) {
    await userEvent.keyboard(`{Control>}{${mod}>}[[{/${mod}}{/Control}`)
  }
  await expect.element(page.getByTestId("project-name")).toHaveTextContent(names.at(-1 - STEPS))
  await expect.poll(() => selectedInView(row.element())).toBe(true)
})

test("the project menu lists every project, cuts long names, scrolls inside the window, and still offers Open folder…", async () => {
  await mountMany("strip")
  await page.getByRole("button", { name: /switch project/ }).click()
  const menu = page.getByRole("menu")
  await expect.element(menu).toBeVisible()

  await expect.poll(() => page.getByRole("menuitemradio").elements()).toHaveLength(COUNT)
  await expect
    .element(page.getByRole("menuitemradio", { name: LAST }))
    .toHaveAttribute("aria-checked", "true")
  await expect
    .poll(() => menu.element().getBoundingClientRect().bottom)
    .toBeLessThanOrEqual(window.innerHeight)
  expect(menu.element().getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
  expect(menu.element().scrollHeight).toBeGreaterThan(menu.element().clientHeight)
  const first = page.getByRole("menuitemradio", { name: FIRST }).element()
  expect(first.getBoundingClientRect().height).toBeLessThan(ONE_LINE)

  const open = page.getByRole("menuitem", { name: "Open folder…" })
  open.element().scrollIntoView()
  await expect.element(open).toBeVisible()
})
