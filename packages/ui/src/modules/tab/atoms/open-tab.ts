import { Effect } from "effect"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { projectsAtom } from "../../project/atoms/list-projects.ts"
import { tabsOf } from "./list-tabs.ts"

export const openTabAtom = serverRuntime.fn<{
  readonly sessionId: string
  readonly after?: string
}>()(
  Effect.fnUntraced(function* ({ sessionId, after }) {
    const client = yield* ServerClient
    const tabs = yield* client["tab.open"](
      after === undefined ? { sessionId } : { sessionId, after },
    )
    yield* tabsOf(tabs.projectPath).set(tabs)
    const projects = yield* projectsAtom.get
    if (projects !== null && projects.selectedPath !== tabs.projectPath) {
      yield* projectsAtom.set(yield* client["project.select"]({ path: tabs.projectPath }))
    }
    return tabs
  }),
)
