import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { discardSessionEditsAtom } from "../../file/atoms/file-edit.ts"
import { sessionsOf } from "../../session/atoms/list-sessions.ts"
import { tabsOf } from "../../tab/atoms/list-tabs.ts"
import { projectsAtom } from "./list-projects.ts"

export const closeProjectAtom = serverRuntime.fn<string>()(
  Effect.fnUntraced(function* (path) {
    const client = yield* ServerClient
    const sessionIds = yield* Atom.get(sessionsOf(path).ids)
    const open = yield* client["project.close"]({ path })
    yield* projectsAtom.set(open)
    yield* tabsOf(path).set({ projectPath: path, tabs: [], selectedSessionId: null })
    for (const sessionId of sessionIds) yield* Atom.set(discardSessionEditsAtom, sessionId)
    return open
  }),
)
