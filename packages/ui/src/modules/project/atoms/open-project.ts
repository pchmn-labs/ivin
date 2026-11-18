import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { projectsAtom } from "./list-projects.ts"

export const openProjectAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (path) {
    const client = yield* ServerClient
    const open = yield* client["project.open"]({ path })
    yield* projectsAtom.set(open)
    return open
  }),
)
