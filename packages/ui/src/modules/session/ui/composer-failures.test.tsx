import { RegistryProvider } from "@effect/atom-react"
import { afterEach, expect, test, vi } from "vitest"
import { page, userEvent } from "vitest/browser"
import { render } from "vitest-browser-react"
import { useState } from "react"
import { builtinPlugins } from "../../../core/test-builtin-plugins.ts"
import { PluginsProvider } from "../../../app/plugin-host.tsx"
import { SidebarTabs } from "../../../app/sidebar-tabs.tsx"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { SessionView } from "./session-view.tsx"

const composerText = () =>
  (page.getByRole("textbox", { name: "Message" }).element() as HTMLElement).innerText

const mod = navigator.platform.includes("Mac") ? "Meta" : "Control"

const mount = async (withSidebar = false) => {
  const server = makeFakeServer()
  server.openProject("/p")
  for (const id of ["s1", "s2"]) {
    server.sessions.set(
      id,
      makeTestSession({
        id,
        title: id,
        projectPath: "/p",
        started: true,
        workingFolder: "/p",
      }),
    )
    server.openTab(id)
  }
  function Switcher() {
    const [shown, setShown] = useState("s1")
    return (
      <>
        <button onClick={() => setShown("s1")}>Show s1</button>
        <button onClick={() => setShown("s2")}>Show s2</button>
        {withSidebar && <SidebarTabs />}
        <SessionView projectPath="/p" sessionId={shown} />
      </>
    )
  }
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <PluginsProvider plugins={builtinPlugins}>
        <Switcher />
      </PluginsProvider>
    </RegistryProvider>,
  )
  return server
}

afterEach(() => vi.unstubAllGlobals())

test("a send that fails while the user is on another tab shows its error, Retry and its text on return", async () => {
  const server = await mount()
  const send = server.holdNextSend()
  await page.getByRole("textbox", { name: "Message" }).fill("keep me")
  await page.getByRole("button", { name: "Send" }).click()
  await page.getByRole("button", { name: "Show s2" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()

  send.fail()
  await vi.waitFor(() =>
    expect(server.errorReports.map((r) => r.action)).toContain("session.sendMessage"),
  )
  await page.getByRole("button", { name: "Show s2" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await page.getByRole("button", { name: "Show s1" }).click()

  const alert = page.getByRole("alert")
  await expect.element(alert.getByRole("button", { name: "Retry" })).toBeVisible()
  await expect.poll(composerText).toBe("keep me")
  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
  await vi.waitFor(() =>
    expect(server.sentMessages.map((m) => m.text)).toEqual(["keep me", "keep me"]),
  )
})

const imageRef = (id: string, number: number) => ({ id, number, mediaType: "image/png" as const })

const stopWithUnreadMessage = async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(new Uint8Array([104, 105]))),
  )
  const server = await mount()
  server.sessions.set("s1", {
    ...server.sessions.get("s1")!,
    unreadMessages: [
      {
        id: "u1",
        text: "see [Image #1] and [Image #2]",
        images: [imageRef("a", 1), imageRef("b", 2)],
      },
    ],
    lastImageNumber: 2,
  })
  server.setStatus("s1", "idle")
  return server
}

test("messages put back by a Stop come with their images, and sending sends both", async () => {
  const server = await stopWithUnreadMessage()
  await vi.waitFor(() => expect(composerText()).toContain("#3"))
  expect(composerText()).toContain("#4")

  await userEvent.keyboard("{Enter}")

  await vi.waitFor(() => expect(server.sentMessages).toHaveLength(1))
  expect(server.sentMessages[0]?.images?.map((image) => image.number)).toEqual([3, 4])
})

test("text the user removed from the put back messages stays removed across tab switches", async () => {
  await stopWithUnreadMessage()
  await vi.waitFor(() => expect(composerText()).toContain("#3"))
  await page.getByRole("textbox", { name: "Message" }).fill("")

  await page.getByRole("button", { name: "Show s2" }).click()
  await page.getByRole("button", { name: "Show s1" }).click()
  await page.getByRole("button", { name: "Show s2" }).click()
  await page.getByRole("button", { name: "Show s1" }).click()

  await expect.element(page.getByRole("textbox", { name: "Message" })).toBeVisible()
  expect(composerText().trim()).toBe("")
})

const mountWithPending = async () => {
  const server = await mount()
  server.sessions.set("s1", {
    ...server.sessions.get("s1")!,
    pendingMessages: [{ id: "p1", text: "also check the logs", images: [] }],
  })
  server.setStatus("s1", "working")
  await expect.element(page.getByTestId("composer-pending")).toBeVisible()
  return server
}

test("the Send now command runs from its keybinding", async () => {
  const server = await mountWithPending()
  await page.getByRole("textbox", { name: "Message" }).click()

  await userEvent.keyboard(`{${mod}>}{Alt>}{Enter}{/Alt}{/${mod}}`)

  await vi.waitFor(() => expect(server.callsOf("session.sendNow")).toBe(1))
  await expect.element(page.getByTestId("composer-pending")).not.toBeInTheDocument()
})

test("a failed Send now shows its message beside the sheet, and Retry sends again", async () => {
  const server = await mountWithPending()
  server.failNextCall("session.sendNow")

  await page.getByRole("button", { name: "Send now" }).click()
  const alert = page.getByRole("alert")
  await expect.element(alert.getByRole("button", { name: "Retry" })).toBeVisible()
  await expect.element(page.getByTestId("composer-pending")).toBeVisible()

  await alert.getByRole("button", { name: "Retry" }).click()
  await expect.element(page.getByTestId("composer-pending")).not.toBeInTheDocument()
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
})

test("a failed rename shows its message under the session's row, and Retry renames", async () => {
  const server = await mount(true)
  server.failNextCall("session.rename")

  const row = page.getByRole("listitem").filter({ hasText: "s1" })
  await row.hover()
  await row.getByRole("button", { name: "Session actions" }).click()
  await page.getByRole("menuitem", { name: "Rename" }).click()
  await page.getByRole("textbox", { name: "Session title" }).fill("Plan")
  await userEvent.keyboard("{Enter}")

  const alert = page.getByRole("alert")
  await expect.element(alert.getByRole("button", { name: "Retry" })).toBeVisible()
  await expect.element(row.getByTestId("session-title")).toHaveTextContent("s1")

  await alert.getByRole("button", { name: "Retry" }).click()
  await vi.waitFor(() => expect(server.sessions.get("s1")?.title).toBe("Plan"))
  await expect.element(page.getByRole("alert")).not.toBeInTheDocument()
})
