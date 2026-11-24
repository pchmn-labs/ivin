import { RegistryProvider } from "@effect/atom-react"
import type { TranscriptItem } from "@ivin/contracts/transcript"
import { DateTime } from "effect"
import { expect, test } from "vitest"
import { page } from "vitest/browser"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { TabBar } from "../../tab/ui/tab-bar.tsx"
import { Announcements } from "./announcements.tsx"

const setup = async () => {
  const server = makeFakeServer({
    project: { path: "/p", name: "p", lastOpenedAt: DateTime.makeUnsafe(0) },
  })
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "Fix the cart" }))
  server.sessions.set("s2", makeTestSession({ id: "s2", title: "Clean the build" }))
  server.openTab("s2")
  server.openTab("s1")
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <TabBar projectPath="/p" />
      <Announcements projectPath="/p" />
    </RegistryProvider>,
  )
  return server
}

const turnEnds = () => page.getByTestId("turn-end-announcement")

// Every text the region takes, so a test sees an announcement a later one replaced.
const heard = (region: Element) => {
  const texts: string[] = []
  new MutationObserver(() => {
    if (region.textContent) texts.push(region.textContent)
  }).observe(region, { childList: true, subtree: true, characterData: true })
  return texts
}
const tab = (title: string) => page.getByRole("tab", { name: new RegExp(title) })
const approvals = () => page.getByTestId("approval-announcement")

const answer = (sessionId: string, id: string, position: number, text: string): TranscriptItem => ({
  id,
  sessionId,
  position,
  at: 0,
  type: "message",
  role: "assistant",
  text,
  images: [],
  steer: false,
})

test("the end of a turn in the session on screen reads its last message once, never the streamed text", async () => {
  const server = await setup()
  await expect.element(turnEnds()).toHaveAttribute("aria-live", "polite")
  const texts = heard(turnEnds().element())
  server.setStatus("s1", "working")
  server.pushChange({
    type: "delta",
    sessionId: "s1",
    itemId: "m1",
    position: 0,
    kind: "message",
    text: "The cart",
  })
  server.pushItem(answer("s1", "m1", 0, "The cart total is fixed."))
  server.setStatus("s1", "idle")
  await expect.element(turnEnds()).toHaveTextContent("The cart total is fixed.")
  expect(texts).toEqual(["The cart total is fixed."])
})

test("a turn ending in another session, or switching to a session, announces nothing", async () => {
  const server = await setup()
  const texts = heard(turnEnds().element())
  server.setStatus("s2", "working")
  server.pushItem(answer("s2", "m1", 0, "The build is clean."))
  server.setStatus("s2", "idle")
  await tab("Clean the build").click()
  await expect.element(tab("Clean the build")).toHaveAttribute("aria-selected", "true")
  server.setStatus("s1", "working")
  await tab("Fix the cart").click()
  await expect.element(tab("Fix the cart")).toHaveAttribute("aria-selected", "true")
  await expect
    .element(tab("Fix the cart").getByText("Working", { exact: false }))
    .toBeInTheDocument()
  server.pushItem(answer("s1", "m2", 0, "Done."))
  server.setStatus("s1", "idle")
  await expect.element(turnEnds()).toHaveTextContent("Done.")
  expect(texts).toEqual(["Done."])
})

test("an approval asked in any session of the project is announced with its title and command", async () => {
  const server = await setup()
  server.pushItem({
    id: "a1",
    sessionId: "s2",
    position: 0,
    at: 0,
    type: "approval",
    requestId: "r1",
    toolCallId: null,
    name: "Bash",
    input: { command: "rm -rf dist\necho done" },
    decision: null,
  })
  server.setStatus("s2", "waiting", "approval")
  await expect
    .element(approvals())
    .toHaveTextContent("Clean the build needs your approval: rm -rf dist")
})
