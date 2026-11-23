import { AsyncResult } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { selectProjectAtom } from "../modules/project/atoms/select-project.ts"
import { makeTestRegistry } from "./test-registry.ts"

test("an RPC that fails is reported to the server", async () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(selectProjectAtom)

  registry.set(selectProjectAtom, "/not/open")

  await vi.waitFor(() =>
    expect(server.errorReports).toMatchObject([
      { action: "project.select", type: "ProjectNotOpen" },
    ]),
  )
})

test("an RPC that succeeds reports nothing", async () => {
  const { registry, server } = makeTestRegistry({ project: "/open" })
  registry.mount(selectProjectAtom)

  registry.set(selectProjectAtom, "/open")

  await vi.waitFor(() => expect(AsyncResult.isSuccess(registry.get(selectProjectAtom))).toBe(true))
  expect(server.errorReports).toEqual([])
})
