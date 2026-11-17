import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { getCurrentProjectAtom } from "./get-current-project.ts"

export const openProjectAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (path, get) {
    const client = yield* ServerClient
    const project = yield* client["project.open"]({ path })
    get.refresh(getCurrentProjectAtom)
    return project
  }),
)
