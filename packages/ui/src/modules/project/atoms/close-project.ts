import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { projectsAtom } from "./list-projects.ts"

export const closeProjectAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (path) {
    const client = yield* ServerClient
    const open = yield* client["project.close"]({ path })
    yield* projectsAtom.set(open)
    yield* tabsOf(path).set({ projectPath: path, tabs: [], selectedSessionId: null })
    return open
  }),
)
