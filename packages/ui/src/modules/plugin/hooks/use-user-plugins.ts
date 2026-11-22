import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useCallback, useEffect, useState } from "react"
import type { UiPlugin } from "@ivin/plugin-api/ui"
import type { ImportBundle } from "../adapters/plugin-bundle.ts"
import type { UiPluginEntry } from "../atoms/activate-plugin.ts"
import { reportPluginFailureAtom, userPluginsAtom } from "../atoms/user-plugins.ts"

const NONE: ReadonlyArray<UiPluginEntry> = []

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

// The user's plugins whose UI half imported; `fail` drops one whose activation threw.
export function useUserPlugins(importBundle: ImportBundle) {
  const result = useAtomValue(userPluginsAtom)
  const listed = AsyncResult.isSuccess(result) ? result.value : null
  const report = useAtomSet(reportPluginFailureAtom)
  const [plugins, setPlugins] = useState(NONE)

  useEffect(() => {
    if (listed === null) return
    let stopped = false
    const load = async (id: string, bundle: string): Promise<UiPluginEntry | null> => {
      let reason: string
      try {
        const { activate } = await importBundle(bundle)
        if (typeof activate === "function")
          return { manifest: { id }, activate: activate as UiPlugin }
        reason = "Its UI half exports no activate function."
      } catch (error) {
        reason = `Could not load its UI half: ${messageOf(error)}`
      }
      if (!stopped) report({ id, reason })
      return null
    }
    void Promise.all(
      listed.flatMap((plugin) =>
        plugin._tag === "compiled" ? [load(plugin.id, plugin.bundle)] : [],
      ),
    ).then((entries) => {
      if (!stopped) setPlugins(entries.filter((entry) => entry !== null))
    })
    return () => {
      stopped = true
    }
  }, [listed, importBundle, report])

  const fail = useCallback(
    (id: string, error: unknown) => {
      report({ id, reason: `Its activate function threw: ${messageOf(error)}` })
      setPlugins((current) => current.filter((plugin) => plugin.manifest.id !== id))
    },
    [report],
  )
  return { plugins, fail }
}
