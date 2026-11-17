import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { createSessionAtom } from "./create-session.ts"
import { sessionsOf } from "./list-sessions.ts"
import { renameSessionAtom } from "./rename-session.ts"
import { sendMessageAtom } from "./send-message.ts"

const project = "/project"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  const sessions = sessionsOf(project)
  registry.mount(sessions.ids)
  registry.mount(createSessionAtom)
  registry.mount(sendMessageAtom)
  registry.mount(renameSessionAtom)
  return { registry, server, sessions }
}

test("the session list shows the newest activity first, after create and after send", async () => {
  const { registry, sessions } = await setup()

  registry.set(createSessionAtom, { projectPath: project, model: "sonnet" })
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toHaveLength(1))
  registry.set(createSessionAtom, { projectPath: project, model: "sonnet" })
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toHaveLength(2))

  const [newest, oldest] = registry.get(sessions.ids)
  expect(registry.get(sessions.item(oldest!))?.id).toBe(oldest)

  registry.set(sendMessageAtom, { projectPath: project, sessionId: oldest!, text: "hello" })
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toEqual([oldest, newest]))
  expect(registry.get(sessions.item(oldest!))?.title).toBe("hello")
})

test("a rename shows at once and is kept once the server answers", async () => {
  const { registry, server, sessions } = await setup()
  registry.set(createSessionAtom, { projectPath: project, model: "sonnet" })
  await vi.waitFor(() => expect(registry.get(sessions.ids)).toHaveLength(1))
  const id = registry.get(sessions.ids)[0]!

  registry.set(renameSessionAtom, { projectPath: project, sessionId: id, title: "Plan" })
  await vi.waitFor(() => expect(server.sessions.get(id)?.title).toBe("Plan"))
  expect(registry.get(sessions.item(id))?.title).toBe("Plan")
})
