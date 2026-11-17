import { RegistryContext, useAtomValue } from "@effect/atom-react"
import { AsyncResult } from "effect/reactivity"
import { useContext, useEffect, useState, type ReactNode } from "react"
import { UiHostProvider, type UiHost } from "@ivin/plugin-api/ui"
import { getCurrentProjectAtom } from "../modules/project/atoms/get-current-project.ts"
import { sessionsOf } from "../modules/session/atoms/list-sessions.ts"
import { transcriptOf } from "../modules/transcript/atoms/get-items.ts"
import { Markdown } from "../modules/transcript/ui/markdown.tsx"
import { activatePlugin, type UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"

const NO_PROJECT = ""

const useProjectPath = () => {
  const project = useAtomValue(getCurrentProjectAtom)
  return AsyncResult.isSuccess(project) ? (project.value?.path ?? NO_PROJECT) : NO_PROJECT
}

const host: UiHost = {
  useSessions: () => useAtomValue(sessionsOf(useProjectPath()).items),
  useSession: (sessionId) =>
    useAtomValue(sessionsOf(useProjectPath()).items).find((s) => s.id === sessionId),
  useTranscript: (sessionId) => useAtomValue(transcriptOf(sessionId).list.items),
  Markdown,
}

export function PluginsProvider({
  plugins,
  children,
}: {
  plugins: ReadonlyArray<UiPluginEntry>
  children: ReactNode
}) {
  const registry = useContext(RegistryContext)
  // Children wait for activation so a virtual list never measures rows that have no contributions yet.
  const [active, setActive] = useState(false)
  useEffect(() => {
    const deactivations = plugins.map((plugin) => activatePlugin(registry, plugin))
    setActive(true)
    return () => {
      deactivations.forEach((deactivate) => deactivate())
      setActive(false)
    }
  }, [registry, plugins])
  return active ? <UiHostProvider host={host}>{children}</UiHostProvider> : null
}
