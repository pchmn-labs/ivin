import { RegistryProvider } from "@effect/atom-react"
import { DateTime } from "effect"
import { expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { ArchivedSessionList } from "./archived-session-list.tsx"
import { SessionActionDialog } from "./session-action-dialog.tsx"

const setup = async (titles: ReadonlyArray<string>) => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  titles.forEach((title, index) => {
    const id = `s${index + 1}`
    server.sessions.set(id, {
      ...makeTestSession({ id, title }),
      archivedAt: DateTime.makeUnsafe(10_000 - index),
    })
  })
  const onBack = vi.fn()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <ArchivedSessionList projectPath="/p" projectName="p" onBack={onBack} />
      <SessionActionDialog />
    </RegistryProvider>,
  )
  return { server, onBack }
}

const rows = () => page.getByTestId("archived-session")

test("a project with no archived session says how to archive one", async () => {
  await setup([])
  await expect.element(page.getByText("No archived sessions in p.")).toBeVisible()
  await expect.element(page.getByText(/Archive a session from its menu/)).toBeVisible()
})

test("the keyboard alone restores an archived session and moves to the next one", async () => {
  const { server } = await setup(["First", "Second"])
  await vi.waitFor(() => expect(rows().first().element().textContent).toContain("First"))
  await vi.waitFor(() => expect(document.activeElement?.textContent).toContain("First"))

  await userEvent.keyboard("{ArrowDown}")
  expect(document.activeElement?.textContent).toContain("Second")
  await userEvent.keyboard("{ArrowUp}{Enter}")

  await vi.waitFor(() => expect(server.sessions.get("s1")?.archivedAt).toBeNull())
  await vi.waitFor(() =>
    expect(
      rows()
        .elements()
        .map((row) => row.textContent),
    ).toHaveLength(1),
  )
  expect(rows().element().textContent).toContain("Second")
  await vi.waitFor(() => expect(document.activeElement?.textContent).toContain("Second"))
})

test("Escape goes back to the project's sessions", async () => {
  const { onBack } = await setup(["First"])
  await vi.waitFor(() => expect(document.activeElement?.textContent).toContain("First"))
  await userEvent.keyboard("{Escape}")
  expect(onBack).toHaveBeenCalledOnce()
})

test("deleting asks first, naming the session, and erases it only once confirmed", async () => {
  const { server } = await setup(["Old spike"])
  await vi.waitFor(() => expect(document.activeElement?.textContent).toContain("Old spike"))

  await userEvent.keyboard("{Meta>}{Backspace}{/Meta}")
  const dialog = page.getByRole("dialog")
  await expect.element(dialog.getByText("Delete “Old spike”?")).toBeVisible()
  await dialog.getByRole("button", { name: "Cancel" }).click()
  expect(server.sessions.has("s1")).toBe(true)

  await rows().getByRole("button", { name: "Delete Old spike" }).click()
  await page.getByRole("dialog").getByRole("button", { name: "Delete session" }).click()
  await vi.waitFor(() => expect(server.sessions.has("s1")).toBe(false))
  await expect.element(page.getByText("No archived sessions in p.")).toBeVisible()
})

test("a failed restore says so under the session's row and keeps it archived", async () => {
  const { server } = await setup(["Kept"])
  server.failNextCall("session.restore")

  await rows().getByRole("button", { name: "Restore Kept" }).click()

  await expect.element(rows().getByRole("alert")).toHaveTextContent("The session was not restored.")
  expect(server.sessions.get("s1")?.archivedAt).not.toBeNull()
})
