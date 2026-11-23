import { RegistryProvider, useAtomValue } from "@effect/atom-react"
import { Atom } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../core/server-client.ts"
import { AreaFailureBoundary, WindowFailureBoundary } from "./failure-boundary.tsx"

const draftAtom = Atom.make("my draft").pipe(Atom.keepAlive)
const state = { broken: true }

function Content() {
  const draft = useAtomValue(draftAtom)
  if (state.broken) throw new TypeError("secret detail")
  return <p>content with {draft}</p>
}

const mount = async (children: React.ReactNode) => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  state.broken = true
  const server = makeFakeServer()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      {children}
    </RegistryProvider>,
  )
  return server
}

test("a render error in the window shows a plain message, never the raw error, and is logged", async () => {
  const server = await mount(
    <WindowFailureBoundary>
      <Content />
    </WindowFailureBoundary>,
  )
  await expect.element(page.getByRole("alert")).toBeVisible()
  expect(document.body.textContent).not.toContain("secret detail")
  await vi.waitFor(() => expect(server.errorReports).toHaveLength(1))
  expect(server.errorReports[0]).toMatchObject({ type: "TypeError", message: "secret detail" })
  await expect.element(page.getByRole("button", { name: "Reload window" })).toBeVisible()
})

test("Retry brings the window back with the atoms it held", async () => {
  await mount(
    <WindowFailureBoundary>
      <Content />
    </WindowFailureBoundary>,
  )
  state.broken = false
  await page.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByText("content with my draft")).toBeVisible()
})

test("an error in the main area leaves what is outside it working, and a new key tries again", async () => {
  const tree = (key: string) => (
    <RegistryProvider initialValues={[[serverClientLayerAtom, makeFakeServer().layer]]}>
      <nav>sidebar</nav>
      <AreaFailureBoundary resetKey={key}>
        <Content />
      </AreaFailureBoundary>
    </RegistryProvider>
  )
  vi.spyOn(console, "error").mockImplementation(() => {})
  state.broken = true
  const view = await render(tree("a"))
  await expect.element(page.getByRole("alert")).toBeVisible()
  await expect.element(page.getByText("sidebar")).toBeVisible()
  await expect.element(page.getByRole("button", { name: "Reload window" })).not.toBeInTheDocument()
  state.broken = false
  await view.rerender(tree("b"))
  await expect.element(page.getByText("content with my draft")).toBeVisible()
})
