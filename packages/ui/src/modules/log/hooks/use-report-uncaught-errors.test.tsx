import { RegistryContext } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import type { UserPlugin } from "@ivin/contracts/plugin"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { listPluginsAtom } from "../../plugin/atoms/list-plugins.ts"
import { useReportUncaughtErrors } from "./use-report-uncaught-errors.ts"

function Reporter() {
  useReportUncaughtErrors()
  return null
}

const mount = async (plugins: ReadonlyArray<UserPlugin> = []) => {
  const { server, registry } = makeTestRegistry()
  server.userPlugins.push(...plugins)
  await render(
    <RegistryContext.Provider value={registry}>
      <Reporter />
    </RegistryContext.Provider>,
  )
  // The hook reads the plugin list as it arrives.
  await vi.waitFor(() => expect(registry.get(listPluginsAtom)._tag).toBe("Success"))
  return server
}

test("an uncaught error outside a plugin is reported to the server", async () => {
  const server = await mount()
  const error = new TypeError("x is undefined")

  window.dispatchEvent(
    new ErrorEvent("error", {
      error,
      message: error.message,
      filename: "http://localhost/src/app/app.tsx",
    }),
  )

  await vi.waitFor(() =>
    expect(server.errorReports).toEqual([
      {
        action: "uncaught error",
        type: "TypeError",
        message: "x is undefined",
        stack: error.stack,
      },
    ]),
  )
})

test("a rejected promise nobody handles is reported to the server", async () => {
  const server = await mount()
  const promise = Promise.reject(new Error("lost"))
  promise.catch(() => {})

  window.dispatchEvent(
    new PromiseRejectionEvent("unhandledrejection", { promise, reason: new Error("lost") }),
  )

  await vi.waitFor(() =>
    expect(server.errorReports).toMatchObject([
      { action: "unhandled rejection", type: "Error", message: "lost" },
    ]),
  )
})

test("an error or rejection from a user plugin's bundle goes to its log, not the app's", async () => {
  const server = await mount([
    { _tag: "compiled", id: "notes", name: "Notes", bundle: "n.js", views: [] },
  ])
  const url = "ivin-plugin-bundle://cache/n.js"

  window.dispatchEvent(
    new ErrorEvent("error", {
      error: new Error("handler bug"),
      message: "handler bug",
      filename: url,
    }),
  )
  const reason = new Error("late")
  reason.stack = `Error: late\n    at later (${url}:1:1)`
  const promise = Promise.reject(reason)
  promise.catch(() => {})
  window.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { promise, reason }))
  // Reports reach the server in order, so the app error arriving shows the others were routed away.
  window.dispatchEvent(
    new ErrorEvent("error", {
      error: new Error("app bug"),
      message: "app bug",
      filename: "http://localhost/src/app/app.tsx",
    }),
  )

  await vi.waitFor(() => expect(server.errorReports).toHaveLength(1))
  expect(server.errorReports).toMatchObject([{ message: "app bug" }])
  await vi.waitFor(() => expect(server.pluginFailures).toHaveLength(2))
  expect(server.pluginFailures).toMatchObject([
    { id: "notes", reason: expect.stringContaining("handler bug") },
    { id: "notes", reason: expect.stringContaining("late") },
  ])
})
