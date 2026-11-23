import { DateTime } from "effect"
import { AsyncResult } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { gitStatusOf } from "./git-status.ts"

const project = "/project"

test("a burst of changes during a read gives one read after it, not one per change", async () => {
  const { registry, server } = makeTestRegistry({ project })
  const at = DateTime.makeUnsafe(0)
  server.sessions.set("s1", {
    id: "s1",
    projectPath: project,
    workingFolder: project,
    inWorktree: false,
    branch: "main",
    started: true,
    workingFolderDeleted: false,
    title: "s1",
    harness: "claude",
    model: "sonnet",
    effort: "high",
    permissionMode: "manual",
    relaunchFailure: null,
    pendingMessages: [],
    unreadMessages: [],
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
    waitingFor: null,
  })
  registry.mount(gitStatusOf("s1"))
  await vi.waitFor(() => expect(AsyncResult.isSuccess(registry.get(gitStatusOf("s1")))).toBe(true))
  const read = server.holdNextCall("file.gitStatus")

  server.changeOnDisk(project, ["a.ts"])
  await vi.waitFor(() => expect(server.callsOf("file.gitStatus")).toBe(2))
  for (const path of ["b.ts", "c.ts", "d.ts", "e.ts"]) server.changeOnDisk(project, [path])
  read.release()

  await vi.waitFor(() => expect(server.callsOf("file.gitStatus")).toBe(3))
  server.gitStatus.set(project, [{ path: "z.ts", status: "untracked" }])
  server.changeOnDisk(project, ["z.ts"])
  await vi.waitFor(() =>
    expect(registry.get(gitStatusOf("s1"))).toMatchObject({ value: [{ path: "z.ts" }] }),
  )
  expect(server.callsOf("file.gitStatus")).toBe(4)
})
