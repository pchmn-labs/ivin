import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult, Atom } from "effect/reactivity"
import type { UserPlugin } from "@ivin/contracts/plugin"
import { useEffect, useState } from "react"
import type { UiPlugin } from "@ivin/plugin-api/ui"
import type { ImportBundle } from "../adapters/plugin-bundle.ts"
import type { UiPluginEntry } from "../atoms/activate-plugin.ts"
import { listBuiltinPluginsAtom } from "../atoms/list-builtin-plugins.ts"
import { reportPluginFailureAtom } from "../atoms/report-plugin-failure.ts"

const noBuiltinPluginsAtom = Atom.make(AsyncResult.success<ReadonlyArray<UserPlugin>>([]))

const NOTHING_TO_LOAD = { ready: true, plugins: [] as ReadonlyArray<UiPluginEntry> }

const NONE: ReadonlyArray<UiPluginEntry> = []

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

// `ready` once every built-in plugin's bundle is imported, so the window never shows before their contributions exist.
export function useBuiltinPlugins(importBundle: ImportBundle, fromServer: boolean) {
  const result = useAtomValue(fromServer ? listBuiltinPluginsAtom : noBuiltinPluginsAtom)
  const report = useAtomSet(reportPluginFailureAtom)
  const [loaded, setLoaded] = useState<{
    readonly ready: boolean
    readonly plugins: ReadonlyArray<UiPluginEntry>
  }>({ ready: false, plugins: NONE })
  const listed = AsyncResult.isSuccess(result) ? result.value : null

  useEffect(() => {
    if (listed === null) return
    let stopped = false
    const load = async (plugin: (typeof listed)[number]): Promise<UiPluginEntry | null> => {
      if (plugin._tag !== "compiled") return null
      let reason: string
      try {
        const { activate } = await importBundle(plugin.bundle, true)
        if (typeof activate === "function") {
          return {
            manifest: { id: plugin.id, views: plugin.views },
            activate: activate as UiPlugin,
          }
        }
        reason = "Its UI half exports no activate function."
      } catch (error) {
        reason = `Could not load its UI half: ${messageOf(error)}`
      }
      report({ id: plugin.id, reason })
      return null
    }
    void Promise.all(listed.map(load)).then((entries) => {
      if (stopped) return
      setLoaded({ ready: true, plugins: entries.filter((entry) => entry !== null) })
    })
    return () => {
      stopped = true
    }
  }, [listed, importBundle, report])

  return fromServer ? loaded : NOTHING_TO_LOAD
}
