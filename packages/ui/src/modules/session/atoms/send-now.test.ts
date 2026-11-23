import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { makeTestSession } from "../../../core/test-session.ts"
import { sendNowAtom, sendNowFailureOf } from "./send-now.ts"

const project = "/project"

const setup = () => {
  const { registry, server } = makeTestRegistry()
  server.sessions.set("s1", makeTestSession({ id: "s1", title: "One", projectPath: project }))
  registry.mount(sendNowAtom)
  return { registry, server }
}

test("a failed Send now records its message for the session, and the next try clears it", async () => {
  const { registry, server } = setup()
  server.failNextCall("session.sendNow")

  registry.set(sendNowAtom, { projectPath: project, sessionId: "s1" })
  await vi.waitFor(() =>
    expect(registry.get(sendNowFailureOf("s1"))).toEqual({
      text: "The messages were not sent now.",
      retryable: true,
    }),
  )

  registry.set(sendNowAtom, { projectPath: project, sessionId: "s1" })
  await vi.waitFor(() => expect(registry.get(sendNowFailureOf("s1"))).toBeNull())
  expect(server.callsOf("session.sendNow")).toBe(2)
})
