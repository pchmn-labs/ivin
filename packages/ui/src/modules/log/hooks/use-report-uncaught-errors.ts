import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useRef } from "react"
import { listBuiltinPluginsAtom } from "../../plugin/atoms/list-builtin-plugins.ts"
import { listPluginsAtom } from "../../plugin/atoms/list-plugins.ts"
import { reportPluginFailureAtom } from "../../plugin/atoms/report-plugin-failure.ts"
import { writeErrorAtom } from "../atoms/write-error.ts"
import { errorReport, pluginOfError } from "../rules/error-report.ts"

export const useReportUncaughtErrors = () => {
  const writeError = useAtomSet(writeErrorAtom)
  const reportPlugin = useAtomSet(reportPluginFailureAtom)
  const listed = useAtomValue(listPluginsAtom)
  const builtin = useAtomValue(listBuiltinPluginsAtom)
  const bundles = useRef(new Map<string, string>())
  bundles.current = new Map(
    [listed, builtin].flatMap((result) =>
      AsyncResult.isSuccess(result)
        ? result.value.flatMap((plugin) =>
            plugin._tag === "compiled" ? [[plugin.bundle, plugin.id] as const] : [],
          )
        : [],
    ),
  )

  useEffect(() => {
    const report = (action: string, filename: string | undefined, error: unknown) => {
      const pluginId = pluginOfError(filename, error, bundles.current)
      if (pluginId === null) return writeError(errorReport(action, error))
      reportPlugin({
        id: pluginId,
        reason: `Its code threw (${action}): ${errorReport(action, error).message}`,
      })
    }
    const onError = (event: ErrorEvent) =>
      report("uncaught error", event.filename, event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) =>
      report("unhandled rejection", undefined, event.reason)
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [writeError, reportPlugin])
}
