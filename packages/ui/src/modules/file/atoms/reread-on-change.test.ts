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
    backgroundTasks: [],
    status: "idle",
    statusChangedAt: at,
    createdAt: at,
    lastActivityAt: at,
    archivedAt: null,
    lastImageNumber: 0,
    waitingFor: null,
  })
  registry.mount(gitStatusOf("s1", project))
  await vi.waitFor(() =>
    expect(AsyncResult.isSuccess(registry.get(gitStatusOf("s1", project)))).toBe(true),
  )
  await vi.waitFor(() => expect(server.callsOf("file.watch")).toBe(1))
  const read = server.holdNextCall("file.gitStatus")

  server.changeOnDisk(project, ["a.ts"])
  await vi.waitFor(() => expect(server.callsOf("file.gitStatus")).toBe(2))
  for (const path of ["b.ts", "c.ts", "d.ts", "e.ts"]) server.changeOnDisk(project, [path])
  read.release()

  server.gitStatus.set(project, [{ path: "z.ts", status: "untracked" }])
  server.changeOnDisk(project, ["z.ts"])
  await vi.waitFor(() =>
    expect(registry.get(gitStatusOf("s1", project))).toMatchObject({ value: [{ path: "z.ts" }] }),
  )
  // One read per change would make 7: the first, one per change, and the one for z.ts.
  expect(server.callsOf("file.gitStatus")).toBeLessThan(7)
})
