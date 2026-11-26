import { Effect } from "effect"
import { type Permissions, type PluginCall, permits } from "../rules/permissions.ts"
import { PluginCallFailed } from "./plugin-services.ts"
import { reportPluginFailure } from "./report-plugin-failure.ts"

export const checkPluginCall = (id: string, permissions: Permissions, call: PluginCall) =>
  Effect.gen(function* () {
    const verdict = permits(permissions, call)
    if (verdict.allowed) return
    const reason = `ctx.${call.member} was refused: its manifest does not declare the permission ${verdict.missing}.`
    yield* reportPluginFailure(id, reason)
    return yield* new PluginCallFailed({ reason })
  })
