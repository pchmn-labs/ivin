import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { projectsAtom } from "./list-projects.ts"

export const openProjectAtom = serverRuntime.fn<{
  readonly path: string
  readonly trust?: boolean
}>()(
  Effect.fnUntraced(function* (input) {
    const client = yield* ServerClient
    const open = yield* client["project.open"](input)
    yield* projectsAtom.set(open)
    return open
  }),
)
