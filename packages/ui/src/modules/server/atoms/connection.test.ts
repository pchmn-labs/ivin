import { expect, test } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { connectionAtom } from "./connection.ts"
import { serverStateAtom } from "./server-state.ts"

test("the connection is restarting while the desktop app restarts the server", () => {
  const { registry } = makeTestRegistry()
  registry.mount(connectionAtom)
  registry.set(serverStateAtom, { kind: "restarting" })

  expect(registry.get(connectionAtom)).toEqual({
    state: "restarting",
    text: "ivin's server stopped. Restarting it…",
  })
})

test("the connection fails with the log's path once the desktop app gives up, and can be restarted", () => {
  const { registry } = makeTestRegistry()
  registry.mount(connectionAtom)
  registry.set(serverStateAtom, { kind: "gave-up", logPath: "/home/.ivin/logs/ivin.log" })

  expect(registry.get(connectionAtom)).toEqual({
    state: "failed",
    text: "ivin's server keeps stopping. Its log is at /home/.ivin/logs/ivin.log.",
    canRestart: true,
  })
})
