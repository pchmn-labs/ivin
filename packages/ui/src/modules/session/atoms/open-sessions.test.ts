import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { openProjectAtom } from "../../project/atoms/open-project.ts"
import { createSessionAtom } from "./create-session.ts"
import { openSessionsAtom } from "./open-sessions.ts"

test("the sessions of every open project are listed, project by project in their order", async () => {
  const { registry, server } = makeTestRegistry({ project: "/a" })
  registry.mount(openSessionsAtom)
  registry.mount(openProjectAtom)
  registry.mount(createSessionAtom)
  registry.set(openProjectAtom, "/b")
  for (const projectPath of ["/b", "/a", "/elsewhere"]) {
    registry.set(createSessionAtom, { projectPath, model: "sonnet" })
  }
  await vi.waitFor(() => expect(server.sessions.size).toBe(3))

  await vi.waitFor(() =>
    expect(registry.get(openSessionsAtom).map((s) => s.projectPath)).toEqual(["/a", "/b"]),
  )
  server.setStatus("session-1", "waiting")
  await vi.waitFor(() =>
    expect(registry.get(openSessionsAtom).find((s) => s.projectPath === "/b")?.status).toBe(
      "waiting",
    ),
  )
})
