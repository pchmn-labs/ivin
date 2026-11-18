import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Cause, Exit } from "effect"
import { useContext, useEffect, useState, type ReactNode } from "react"
import { UiHostProvider, type UiHost } from "@ivin/plugin-api/ui"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { answerApprovalAtom } from "../modules/session/atoms/answer-approval.ts"
import { sessionsOf } from "../modules/session/atoms/list-sessions.ts"
import { answerApprovalFailure } from "../modules/session/rules/failure-message.ts"
import { tabsOf } from "../modules/tab/atoms/list-tabs.ts"
import { openTabAtom } from "../modules/tab/atoms/open-tab.ts"
import { transcriptOf } from "../modules/transcript/atoms/get-items.ts"
import { hostComponents } from "./host-components.ts"
import { activatePlugin, type UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { useKeyboardHandler } from "../modules/keybinding/hooks/use-keyboard-handler.ts"

const NO_PROJECT = ""

const useProjectPath = () => useAtomValue(selectedProjectAtom)?.path ?? NO_PROJECT

const host: UiHost = {
  useSessions: () => useAtomValue(sessionsOf(useProjectPath()).items),
  useSession: (sessionId) =>
    useAtomValue(sessionsOf(useProjectPath()).items).find((s) => s.id === sessionId),
  useTabs: () => useAtomValue(tabsOf(useProjectPath()).value).tabs,
  useOpenTab: () => {
    const openTab = useAtomSet(openTabAtom)
    return (sessionId) => openTab({ sessionId })
  },
  useTranscript: (sessionId) => useAtomValue(transcriptOf(sessionId).list.items),
  useAnswerApproval: (sessionId) => {
    const projectPath = useProjectPath()
    const answer = useAtomSet(answerApprovalAtom, { mode: "promiseExit" })
    return async ({ requestId, allow }) => {
      const exit = await answer({ projectPath, sessionId, requestId, allow })
      return Exit.isFailure(exit) ? answerApprovalFailure(Cause.squash(exit.cause)) : undefined
    }
  },
  components: hostComponents,
}

export function PluginsProvider({
  plugins,
  children,
}: {
  plugins: ReadonlyArray<UiPluginEntry>
  children: ReactNode
}) {
  const registry = useContext(RegistryContext)
  useKeyboardHandler()
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
