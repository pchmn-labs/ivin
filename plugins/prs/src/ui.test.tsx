import { expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { testUiHost } from "../../../packages/ui/src/app/test-ui-host.ts"
import { activatePlugin } from "../../../packages/ui/src/app/test-plugin-mount.ts"
import { UiHostProvider } from "@ivin/plugin-api/ui"
import type { Annotation, PrAnnotationData, Session, UiHost } from "@ivin/plugin-api/ui"
import { activate } from "./ui.tsx"

const session = { id: "s1" } as Session
const at = { epochMilliseconds: 0 }

const annotation = (id: string, ns: string, data: Partial<PrAnnotationData> & { url: string }) =>
  ({
    id,
    ns,
    kind: "pr",
    target: { _tag: "session", sessionId: "s1" },
    data: { relation: "created", ...data },
    createdAt: at,
    updatedAt: at,
  }) as Annotation

const url = (n: number) => `https://github.com/acme/shop/pull/${n}`

const mount = async (
  annotations: ReadonlyArray<Annotation>,
  removeAnnotation = vi.fn().mockResolvedValue(undefined),
) => {
  const slot = activatePlugin(activate, "prs")
  const Badge = slot("session.badge")
  const Card = slot("session.card")
  const host: UiHost = {
    ...testUiHost,
    useAnnotations: (_sessionId, kind) => annotations.filter((a) => a.kind === kind),
    useRemoveAnnotation: () => removeAnnotation,
  }
  await render(
    <UiHostProvider host={host}>
      <div data-testid="badge">
        <Badge session={session} />
      </div>
      <div data-testid="card">
        <Card session={session} />
      </div>
    </UiHostProvider>,
  )
  return removeAnnotation
}

test("the badge counts the pull requests after the lead", async () => {
  await mount([
    annotation("a1", "github", { url: url(1), state: "open", title: "First" }),
    annotation("a2", "github", { url: url(2), state: "merged", title: "Second" }),
    annotation("a3", "cli", { url: url(3), title: "Third" }),
  ])
  await expect.element(page.getByTestId("badge")).toHaveTextContent("+2")
})

test("a session with no pull request shows no badge and an empty card", async () => {
  await mount([])
  await expect.element(page.getByTestId("badge")).toBeEmptyDOMElement()
  await expect.element(page.getByTestId("card")).toBeEmptyDOMElement()
})

test("a pull request reported by two namespaces is one row", async () => {
  await mount([
    annotation("cli1", "cli", { url: url(1) }),
    annotation("gh1", "github", { url: url(1), state: "open", title: "Keep the return path" }),
  ])
  await expect.element(page.getByText("Keep the return path")).toBeVisible()
  await expect.element(page.getByRole("link")).toHaveLength(1)
  await expect.element(page.getByTestId("badge")).not.toHaveTextContent("+")
})

test("removing a pull request removes every annotation of its url, in any namespace", async () => {
  const remove = await mount([
    annotation("cli1", "cli", { url: url(1) }),
    annotation("gh1", "github", { url: url(1), state: "open", title: "Keep the return path" }),
    annotation("gh2", "github", { url: url(2), state: "open", title: "Other" }),
  ])
  await page.getByRole("link", { name: /Keep the return path/ }).hover()
  await page.getByRole("button", { name: "Remove from this session" }).first().click()
  await vi.waitFor(() => expect(remove).toHaveBeenCalledTimes(2))
  expect(
    remove.mock.calls.map(([id]) => id).toSorted((a, b) => String(a).localeCompare(String(b))),
  ).toEqual(["cli1", "gh1"])
})

test("a failed removal shows its message under the row", async () => {
  await mount(
    [annotation("gh1", "github", { url: url(1), state: "open", title: "Keep the return path" })],
    vi.fn().mockResolvedValue({ text: "It could not be removed. Try again.", retryable: true }),
  )
  await page.getByRole("link", { name: /Keep the return path/ }).hover()
  await page.getByRole("button", { name: "Remove from this session" }).click()
  await expect.element(page.getByText("It could not be removed. Try again.")).toBeVisible()
})

test("a status error is shown once at the card's foot", async () => {
  await mount([
    annotation("gh1", "github", { url: url(1), state: "open", error: "gh is not signed in" }),
    annotation("gh2", "github", { url: url(2), state: "open", error: "gh is not signed in" }),
  ])
  await expect.element(page.getByText("gh is not signed in")).toBeVisible()
})
