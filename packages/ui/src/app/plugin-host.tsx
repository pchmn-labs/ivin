import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Cause, Effect, Exit } from "effect"
import { AtomRegistry } from "effect/reactivity"
import { useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { UiHostProvider, type UiHost } from "@ivin/plugin-api/ui"
import { projectsAtom } from "../modules/project/atoms/list-projects.ts"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { answerApprovalAtom } from "../modules/session/atoms/answer-approval.ts"
import { openSessionsAtom } from "../modules/session/atoms/open-sessions.ts"
import { useSessionActions } from "../modules/session/hooks/use-session-actions.ts"
import { answerApprovalFailure } from "../modules/session/rules/failure-message.ts"
import { tabsOf } from "../modules/tab/atoms/list-tabs.ts"
import { openTabAtom } from "../modules/tab/atoms/open-tab.ts"
import { selectedSessionIdAtom } from "../modules/tab/atoms/selected-session-id.ts"
import { folderKey, listFolderOf } from "../modules/file/atoms/list-folder.ts"
import { folderListingFailure } from "../modules/file/rules/folder-listing.ts"
import { transcriptOf } from "../modules/transcript/atoms/get-items.ts"
import { hostComponents } from "./host-components.ts"
import { activatePlugin, type UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { useKeyboardHandler } from "../modules/keybinding/hooks/use-keyboard-handler.ts"

const NO_PROJECT = ""

const useProjectPath = () => useAtomValue(selectedProjectAtom)?.path ?? NO_PROJECT

const host: UiHost = {
  useSessions: () => useAtomValue(openSessionsAtom),
  useProjects: () => useAtomValue(projectsAtom.value),
  useSelectedSessionId: () => useAtomValue(selectedSessionIdAtom),
  useSession: (sessionId) => useAtomValue(openSessionsAtom).find((s) => s.id === sessionId),
  useTabs: () => useAtomValue(tabsOf(useProjectPath()).value).tabs,
  useOpenTab: () => {
    const openTab = useAtomSet(openTabAtom)
    return (sessionId) => openTab({ sessionId })
  },
  useTranscript: (sessionId) => useAtomValue(transcriptOf(sessionId).list.items),
  useAnswerApproval: (sessionId) => {
    // The session may belong to another project than the one on screen, from the Working panel.
    const projectPath =
      useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)?.projectPath ?? NO_PROJECT
    const answer = useAtomSet(answerApprovalAtom, { mode: "promiseExit" })
    return async ({ requestId, allow }) => {
      const exit = await answer({ projectPath, sessionId, requestId, allow })
      return Exit.isFailure(exit) ? answerApprovalFailure(Cause.squash(exit.cause)) : undefined
    }
  },
  useSessionActions,
  useListFolder: () => {
    const registry = useContext(RegistryContext)
    return useCallback(
      async (sessionId, path) => {
        const atom = listFolderOf(folderKey(sessionId, path))
        registry.set(atom, { sessionId, path })
        const exit = await Effect.runPromiseExit(
          AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
        )
        return Exit.isSuccess(exit)
          ? { kind: "listed", entries: exit.value }
          : folderListingFailure(Cause.squash(exit.cause), path)
      },
      [registry],
    )
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
