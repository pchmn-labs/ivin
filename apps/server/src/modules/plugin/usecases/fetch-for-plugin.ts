import type { PluginFetchRequest } from "@ivin/contracts/plugin-fetch"
import { decodeFetchRequest, encodeFetchResponse } from "@ivin/state/plugin-fetch-wire"
import { Effect } from "effect"
import type { Permissions } from "../rules/permissions.ts"
import { checkPluginCall } from "./check-plugin-call.ts"
import { PluginCallFailed } from "./plugin-services.ts"

const MAX_REDIRECTS = 20
const REDIRECTS = [301, 302, 303, 307, 308]

const failed = (error: unknown) =>
  new PluginCallFailed({ reason: error instanceof Error ? error.message : String(error) })

export const fetchForPlugin = (id: string, permissions: Permissions, request: PluginFetchRequest) =>
  Effect.gen(function* () {
    let { url, method, headers, body } = decodeFetchRequest(request)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      yield* checkPluginCall(id, permissions, { member: "fetch", url })
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetch(url, {
            method,
            headers: headers.map(([name, value]) => [name, value]),
            body,
            // Each hop's host is checked before its request leaves.
            redirect: "manual",
            signal,
          }),
        catch: failed,
      })
      const location = response.headers.get("location")
      if (!REDIRECTS.includes(response.status) || location === null) {
        return yield* Effect.tryPromise({
          try: () => encodeFetchResponse(url, response),
          catch: failed,
        })
      }
      void response.body?.cancel()
      const next = new URL(location, url)
      // As a browser does: credentials stay with their origin.
      if (next.origin !== new URL(url).origin) {
        headers = headers.filter(([name]) => !["authorization", "cookie"].includes(name))
      }
      if (response.status === 303 || (response.status <= 302 && method === "POST")) {
        method = "GET"
        body = null
        headers = headers.filter(([name]) => !name.startsWith("content-"))
      }
      url = next.href
    }
    return yield* new PluginCallFailed({ reason: `More than ${MAX_REDIRECTS} redirects.` })
  })
