import { RegistryContext } from "@effect/atom-react"
import { useContext, useEffect } from "react"
import { getStartupNotice } from "../adapters/desktop-plugin.ts"
import { startupNoticeAtom } from "../atoms/startup-notice.ts"
import { startupNoticeOf } from "../rules/startup-notice.ts"

export function useStartupNoticeBridge() {
  const registry = useContext(RegistryContext)
  useEffect(() => {
    void getStartupNotice().then((raw) => registry.set(startupNoticeAtom, startupNoticeOf(raw)))
  }, [registry])
}
