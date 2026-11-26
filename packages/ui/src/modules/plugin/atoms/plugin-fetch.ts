import type { PluginFetchRequest, PluginFetchResponse } from "@ivin/contracts/plugin-fetch"
import { Effect } from "effect"
import type { AtomRegistry } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"

interface PluginFetch {
  readonly id: string
  readonly request: PluginFetchRequest
  readonly settle: (answer: PluginFetchResponse | Error) => void
}

const pluginFetchAtom = serverRuntime.fn<PluginFetch>()(
  Effect.fnUntraced(function* ({ id, request, settle }) {
    const client = yield* ServerClient
    yield* client["plugin.fetch"]({ id, request }).pipe(
      Effect.match({
        onSuccess: settle,
        onFailure: (error) =>
          settle(
            new Error(
              error._tag === "PluginFetchFailed" ? error.reason : "ivin's server did not answer.",
            ),
          ),
      }),
    )
  }),
  { concurrent: true },
)

export const pluginFetch = (
  registry: AtomRegistry.AtomRegistry,
  id: string,
  request: PluginFetchRequest,
) =>
  new Promise<PluginFetchResponse>((resolve, reject) =>
    registry.set(pluginFetchAtom, {
      id,
      request,
      settle: (answer) => (answer instanceof Error ? reject(answer) : resolve(answer)),
    }),
  )
