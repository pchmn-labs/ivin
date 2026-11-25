import { SessionNotFound } from "@ivin/contracts/session"
import { sameSubView, type SubView } from "@ivin/contracts/tab"
import type { ActionFailure, ViewParams, ViewPlacement } from "@ivin/plugin-api/ui"
import { Cause, Data, Effect, Exit } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { serverRuntime } from "../../../core/server-client.ts"
import { openSessionsAtom } from "../../session/atoms/open-sessions.ts"
import { settingsWithPluginsAtom, watchedSettingsAtom } from "../../setting/atoms/settings.ts"
import { openSubView } from "../../tab/atoms/open-sub-view.ts"
import { subViewsOf } from "../../tab/atoms/list-sub-views.ts"
import { placementSettingKey, resolvePlacement } from "../rules/placement.ts"
import { withSheetViewOpen } from "../rules/overlay-views.ts"
import { declaredViewsAtom } from "./registered-views.ts"
import { dialogViewOf, sheetViewsOf } from "./overlay-views.ts"

export class ViewNotDeclared extends Data.TaggedError("ViewNotDeclared")<{
  readonly view: string
}> {}

export interface OpenView {
  readonly sessionId: string
  readonly view: string
  readonly params: ViewParams
  readonly placement?: ViewPlacement | undefined
}

export const openViewAtom = serverRuntime.fn<OpenView>()(
  Effect.fnUntraced(function* ({ sessionId, view, params, placement }, get) {
    const registry = get.registry
    const session = registry.get(openSessionsAtom).find((s) => s.id === sessionId)
    if (session === undefined) return yield* new SessionNotFound({ sessionId })
    const declaration = registry.get(declaredViewsAtom).find((d) => d.id === view)
    if (declaration === undefined) return yield* new ViewNotDeclared({ view })
    const opened: SubView = { view, params }
    const { workingFolder } = session
    const sheet = sheetViewsOf(sessionId, workingFolder)
    const dialog = dialogViewOf(sessionId, workingFolder)

    // An equal view that is open already is selected where it is, whatever the placement.
    const stored = registry.get(subViewsOf(sessionId, workingFolder).value)
    if (stored.subViews.some((open) => sameSubView(open, opened))) {
      return yield* openSubView(sessionId, workingFolder, opened)
    }
    if (registry.get(sheet).views.some((open) => sameSubView(open, opened))) {
      registry.set(sheet, withSheetViewOpen(registry.get(sheet), opened))
      return undefined
    }
    const shown = registry.get(dialog)
    if (shown !== null && sameSubView(shown, opened)) return undefined

    // The placement setting may not have arrived yet when a plugin opens a view as the window starts.
    yield* AtomRegistry.getResult(registry, watchedSettingsAtom).pipe(Effect.ignore)
    const setting =
      registry.get(settingsWithPluginsAtom).plugins[declaration.pluginId]?.[
        placementSettingKey(declaration.name)
      ]
    const where = resolvePlacement(declaration, setting, placement)
    if (where === "sheet") registry.set(sheet, withSheetViewOpen(registry.get(sheet), opened))
    else if (where === "dialog") registry.set(dialog, opened)
    else yield* openSubView(sessionId, workingFolder, opened)
    return undefined
  }),
)

// Runs the open and answers what the caller shows when it fails; undefined once it worked.
export const runOpenView = async (
  registry: AtomRegistry.AtomRegistry,
  request: OpenView,
  describe: (error: unknown) => ActionFailure,
): Promise<ActionFailure | undefined> => {
  registry.set(openViewAtom, request)
  const exit = await Effect.runPromiseExit(
    AtomRegistry.getResult(registry, openViewAtom, { suspendOnWaiting: true }),
  )
  return Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)
    ? describe(Cause.squash(exit.cause))
    : undefined
}
