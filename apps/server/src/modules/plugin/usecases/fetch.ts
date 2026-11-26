import { PluginFetchFailed, type PluginFetchRequest } from "@ivin/contracts/plugin-fetch"
import { Effect } from "effect"
import { fetchForPlugin } from "./fetch-for-plugin.ts"
import { UiHalfPermissions } from "./ui-half-permissions.ts"

export const fetchForUiHalf = (id: string, request: PluginFetchRequest) =>
  Effect.gen(function* () {
    const permissions = (yield* UiHalfPermissions).of(id)
    return yield* fetchForPlugin(id, permissions, request)
  }).pipe(
    Effect.catchTag("PluginCallFailed", ({ reason }) =>
      Effect.fail(new PluginFetchFailed({ reason })),
    ),
  )
