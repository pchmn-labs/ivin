import { useAtomSet } from "@effect/atom-react"
import { useEffect } from "react"
import { writeErrorAtom } from "../atoms/write-error.ts"
import { errorReport, thrownByPlugin } from "../rules/error-report.ts"

export const useReportUncaughtErrors = () => {
  const writeError = useAtomSet(writeErrorAtom)

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error: unknown = event.error ?? event.message
      if (thrownByPlugin(event.filename, error)) return
      writeError(errorReport("uncaught error", error))
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      if (thrownByPlugin(undefined, event.reason)) return
      writeError(errorReport("unhandled rejection", event.reason))
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    }
  }, [writeError])
}
