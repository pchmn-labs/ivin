import { RegistryProvider } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { makeFakeServer } from "../../../core/fake-server-client.ts"
import { serverClientLayerAtom } from "../../../core/server-client.ts"
import { useReportUncaughtErrors } from "./use-report-uncaught-errors.ts"

function Reporter() {
  useReportUncaughtErrors()
  return null
}

const mount = async () => {
  const server = makeFakeServer()
  await render(
    <RegistryProvider initialValues={[[serverClientLayerAtom, server.layer]]}>
      <Reporter />
    </RegistryProvider>,
  )
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

test("an error thrown by a plugin is not reported", async () => {
  const server = await mount()

  window.dispatchEvent(
    new ErrorEvent("error", {
      error: new Error("plugin bug"),
      message: "plugin bug",
      filename: "http://localhost/plugins/usage/src/ui.tsx",
    }),
  )

  // Reports reach the server in order, so the second one arriving shows the first was dropped.
  window.dispatchEvent(
    new ErrorEvent("error", {
      error: new Error("app bug"),
      message: "app bug",
      filename: "http://localhost/src/app/app.tsx",
    }),
  )
  await vi.waitFor(() => expect(server.errorReports).toHaveLength(1))
  expect(server.errorReports).toMatchObject([{ message: "app bug" }])
})
