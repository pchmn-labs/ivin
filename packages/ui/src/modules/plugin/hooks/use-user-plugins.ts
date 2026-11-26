import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useCallback, useEffect, useRef, useState } from "react"
import type { ViewDeclaration } from "@ivin/contracts/plugin"
import type { UiPlugin } from "@ivin/plugin-api/ui"
import type { ImportBundle } from "../adapters/plugin-bundle.ts"
import type { UiPluginEntry } from "../atoms/activate-plugin.ts"
import { listPluginsAtom } from "../atoms/list-plugins.ts"
import { reportPluginFailureAtom } from "../atoms/report-plugin-failure.ts"

type ViewDeclarations = ReadonlyArray<ViewDeclaration>

const NONE: ReadonlyArray<UiPluginEntry> = []

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function useUserPlugins(importBundle: ImportBundle) {
  const result = useAtomValue(listPluginsAtom)
  const listed = AsyncResult.isSuccess(result) ? result.value : null
  const report = useAtomSet(reportPluginFailureAtom)
  const [plugins, setPlugins] = useState(NONE)
  const shown = useRef(NONE)

  // Started once per bundle, so a longer list neither imports nor reports a plugin twice.
  const loads = useRef(new Map<string, Promise<UiPluginEntry | null>>())
  const failed = useRef(new Set<string>())
  const keys = useRef(new WeakMap<UiPluginEntry, string>())

  useEffect(() => {
    if (listed === null) return
    let stopped = false
    const load = async (
      id: string,
      bundle: string,
      views: ViewDeclarations,
    ): Promise<UiPluginEntry | null> => {
      let reason: string
      try {
        const { activate } = await importBundle(bundle, false)
        if (typeof activate === "function")
          return { manifest: { id, views }, activate: activate as UiPlugin }
        reason = "Its UI half exports no activate function."
      } catch (error) {
        reason = `Could not load its UI half: ${messageOf(error)}`
      }
      report({ id, reason })
      return null
    }
    const entries = listed.flatMap((plugin) => {
      if (plugin._tag !== "compiled") return []
      const key = `${plugin.id}\0${plugin.bundle}`
      const started = loads.current.get(key) ?? load(plugin.id, plugin.bundle, plugin.views)
      loads.current.set(key, started)
      return [
        started.then((entry) => {
          if (entry !== null) keys.current.set(entry, key)
          return entry
        }),
      ]
    })
    void Promise.all(entries).then((loaded) => {
      if (stopped) return
      const next = loaded
        .filter((entry) => entry !== null)
        .filter((entry) => !failed.current.has(keys.current.get(entry)!))
      const current = shown.current
      if (current.length === next.length && current.every((entry, i) => entry === next[i])) return
      shown.current = next
      setPlugins(next)
    })
    return () => {
      stopped = true
    }
  }, [listed, importBundle, report])

  const dropFailedPlugin = useCallback(
    (entry: UiPluginEntry, error: unknown) => {
      const id = entry.manifest.id
      report({ id, reason: `Its activate function threw: ${messageOf(error)}` })
      const failedKey = keys.current.get(entry)
      if (failedKey !== undefined) failed.current.add(failedKey)
      shown.current = shown.current.filter((plugin) => plugin.manifest.id !== id)
      setPlugins(shown.current)
    },
    [report],
  )
  return { plugins, dropFailedPlugin }
}
