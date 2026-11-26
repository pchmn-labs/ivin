import { RegistryProvider } from "@effect/atom-react"
import type { SessionStatus } from "@ivin/contracts/session"
import type { UpdateState } from "@ivin/contracts/update"
import { DateTime } from "effect"
import { afterEach, expect, test, vi } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { updateStateAtom } from "../atoms/update-state.ts"
import { UpdateButton } from "./update-button.tsx"

const ready: UpdateState = {
  kind: "ready",
  current: "0.3.2",
  version: "0.4.0",
  notes: "### Features\n\n- background tasks",
  url: "https://github.com/pchmn-labs/ivin/releases/tag/v0.4.0",
}

const desktop = {
  restartToUpdate: vi.fn(() => Promise.resolve()),
  checkForUpdates: vi.fn(() => Promise.resolve(ready)),
}

afterEach(() => {
  vi.clearAllMocks()
  Reflect.deleteProperty(window, "ivin")
})

const show = async (state: UpdateState | null, agents: ReadonlyArray<SessionStatus> = []) => {
  Object.assign(window, { ivin: desktop })
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  agents.forEach((status, index) =>
    server.sessions.set(
      `s${index}`,
      makeTestSession({ id: `s${index}`, title: `Session ${index}`, status }),
    ),
  )
  await render(
    <RegistryProvider
      initialValues={[
        [serverClientLayerAtom, server.layer],
        [updateStateAtom, state],
      ]}
    >
      <UpdateButton />
    </RegistryProvider>,
  )
}

test("nothing shows before an update is known, or when the app is up to date", async () => {
  await show(null)
  await expect.element(page.getByRole("button")).not.toBeInTheDocument()
})

test("a ready update shows Restart to update, with the release notes on hover", async () => {
  await show(ready)
  const button = page.getByRole("button", { name: "Restart to update" })

  await button.hover()

  await expect.element(page.getByText("ivin 0.4.0 is ready. Restart to update.")).toBeVisible()
  await expect.element(page.getByText("background tasks")).toBeVisible()
  await expect.element(page.getByRole("link", { name: "View release on GitHub" })).toBeVisible()
})

test("with no agent running, the click restarts at once", async () => {
  await show(ready, ["idle"])

  await page.getByRole("button", { name: "Restart to update" }).click()

  await vi.waitFor(() => expect(desktop.restartToUpdate).toHaveBeenCalledOnce())
})

test("with agents running, the click asks first, names them, and Cancel restarts nothing", async () => {
  await show(ready, ["working", "in_background", "idle"])

  await page.getByRole("button", { name: "Restart to update" }).click()

  const dialog = page.getByRole("dialog", { name: "Restart ivin to update to 0.4.0?" })
  await expect.element(dialog).toBeVisible()
  await expect.element(dialog.getByText(/2 agents are running/)).toBeVisible()
  await expect.element(dialog.getByText("Session 0")).toBeVisible()
  await expect.element(dialog.getByText("Session 1")).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect.element(dialog).not.toBeInTheDocument()
  expect(desktop.restartToUpdate).not.toHaveBeenCalled()
})

test("confirming the restart with agents running restarts", async () => {
  await show(ready, ["working"])

  await page.getByRole("button", { name: "Restart to update" }).click()
  await page.getByRole("button", { name: "Restart and update" }).click()

  await vi.waitFor(() => expect(desktop.restartToUpdate).toHaveBeenCalledOnce())
})

test("a failed update says why and offers Retry, which checks again", async () => {
  await show({ kind: "failed", current: "0.3.2", reason: "notWritable" })

  await page.getByRole("button", { name: "Update failed" }).hover()

  await expect.element(page.getByText(/Move ivin to a folder you can write to/)).toBeVisible()
  await page.getByRole("button", { name: "Retry" }).click()
  await vi.waitFor(() => expect(desktop.checkForUpdates).toHaveBeenCalledOnce())
})

test("a download in progress shows its percentage", async () => {
  await show({ ...ready, kind: "downloading", percent: 73 })

  await page.getByRole("button", { name: "Downloading ivin 0.4.0…" }).hover()

  await expect.element(page.getByText("Downloading ivin 0.4.0 (73%)")).toBeVisible()
})
