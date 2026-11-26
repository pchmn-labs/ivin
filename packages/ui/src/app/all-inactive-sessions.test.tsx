import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { makeFakeServer } from "../core/fake-server-client.ts"
import { makeTestSession } from "../core/test-session.ts"
import { mountApp as mountServer } from "./test-app.tsx"

const mountApp = async () => {
  const server = makeFakeServer({
    project: { path: "/dev/ivin", name: "ivin", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  for (const [id, title] of [
    ["s1", "Open one"],
    ["s2", "Closed one"],
    ["s3", "Closed two"],
    ["s4", "Closed three"],
  ] as const) {
    server.sessions.set(
      id,
      makeTestSession({ id, title, projectPath: "/dev/ivin", workingFolder: "/dev/ivin" }),
    )
  }
  server.openTab("s1")
  await mountServer(server)
  await expect.element(page.getByText(/^Inactive sessions/)).toBeVisible()
  return server
}

const pick = async (label: string) => {
  await page.getByText(/^Inactive sessions/).hover()
  await page.getByRole("button", { name: "Actions for the inactive sessions" }).click()
  await page.getByRole("menuitem", { name: label }).click()
}

const inactive = ["s2", "s3", "s4"]

test("Archive all asks once, naming the running agent, then archives every inactive session", async () => {
  const server = await mountApp()
  server.setStatus("s3", "working")

  await pick("Archive all")
  const dialog = page.getByRole("dialog")
  await expect.element(dialog.getByText("Archive 3 inactive sessions?")).toBeVisible()
  await expect.element(dialog.getByRole("listitem").filter({ hasText: "Closed two" })).toBeVisible()
  await dialog.getByRole("button", { name: "Stop and archive all" }).click()

  await expect.element(page.getByText(/^Inactive sessions/)).not.toBeInTheDocument()
  for (const id of inactive) expect(server.sessions.get(id)?.archivedAt).not.toBeNull()
  expect(server.sessions.get("s1")?.archivedAt).toBeNull()
})

test("Delete all erases every inactive session, listing none when no agent runs; Cancel changes nothing", async () => {
  const server = await mountApp()

  await pick("Delete all…")
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click()
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument()
  for (const id of inactive) expect(server.sessions.has(id)).toBe(true)

  await pick("Delete all…")
  const dialog = page.getByRole("dialog")
  await expect.element(dialog.getByText("Delete 3 inactive sessions?")).toBeVisible()
  expect(dialog.getByRole("listitem").query()).toBeNull()
  await dialog.getByRole("button", { name: "Delete all" }).click()

  await expect.element(page.getByText(/^Inactive sessions/)).not.toBeInTheDocument()
  for (const id of inactive) expect(server.sessions.has(id)).toBe(false)
  expect(server.sessions.has("s1")).toBe(true)
})

test("a session that fails stays under its error, and the others are archived anyway", async () => {
  const server = await mountApp()
  server.failNextCall("session.archive")

  await pick("Archive all")
  await page.getByRole("dialog").getByRole("button", { name: "Archive all" }).click()

  const section = page.getByTestId("inactive-sessions")
  await section.getByText(/^Inactive sessions/).click()
  await expect.element(section.getByTestId("inactive-session")).toHaveLength(1)
  await expect
    .element(section.getByRole("alert"))
    .toHaveTextContent("The session was not archived.")
  expect(inactive.filter((id) => server.sessions.get(id)?.archivedAt === null)).toHaveLength(1)
})
