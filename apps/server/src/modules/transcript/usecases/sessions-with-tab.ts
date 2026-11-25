import { Context, type Effect } from "effect"

// Provided by the tab module, above this one.
export class SessionsWithTab extends Context.Service<
  SessionsWithTab,
  { readonly ids: Effect.Effect<readonly string[]> }
>()("ivin/server/SessionsWithTab") {}
