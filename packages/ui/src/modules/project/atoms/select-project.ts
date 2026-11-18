import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { openProjectsAtom } from "./list-projects.ts"

export const selectProjectAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (path) {
    const client = yield* ServerClient
    const open = yield* client["project.select"]({ path })
    yield* openProjectsAtom.set(open)
    return open
  }),
)
