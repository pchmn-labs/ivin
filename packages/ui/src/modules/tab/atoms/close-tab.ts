import { Effect } from "effect"
import { Atom } from "effect/reactivity"
import type { ProjectTabs } from "@ivin/contracts/tab"
import { ServerClient, serverRuntime } from "../../../core/server-client.ts"
import { discardSessionEditsAtom } from "../../file/atoms/file-edit.ts"
import { tabsOf } from "./list-tabs.ts"

// Hides the session's tab until `run` answers with the bar the server keeps.
export const closingTab =
  (projectPath: string, sessionId: string) =>
  <E, R>(run: Effect.Effect<ProjectTabs, E, R>) =>
    Effect.gen(function* () {
      const client = yield* ServerClient
      const tabs = tabsOf(projectPath)
      const settle = Atom.update(tabs.closing, (ids) => ids.filter((id) => id !== sessionId))
      yield* Atom.update(tabs.closing, (ids) => [...ids, sessionId])
      return yield* run.pipe(
        Effect.tap(tabs.set),
        // The server may have closed the tab before it failed.
        Effect.onError(() =>
          client["tab.list"]({ projectPath }).pipe(Effect.flatMap(tabs.set), Effect.ignore),
        ),
        Effect.ensuring(settle),
      )
    })

export const closeTabAtom = serverRuntime
  .fn<{
    readonly projectPath: string
    readonly sessionId: string
    readonly discardEdits?: boolean
  }>()(
    Effect.fnUntraced(function* ({ projectPath, sessionId, discardEdits = false }) {
      const client = yield* ServerClient
      // Never fails: a result shared between concurrent closes would blame the wrong tab.
      yield* closingTab(
        projectPath,
        sessionId,
      )(client["tab.close"]({ sessionId })).pipe(
        Effect.andThen(discardEdits ? Atom.set(discardSessionEditsAtom, sessionId) : Effect.void),
        Effect.catchCause(() => Effect.void),
      )
    }),
    { concurrent: true },
  )
  .pipe(Atom.keepAlive)
