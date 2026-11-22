import { RegistryContext, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Cause, Effect, Exit } from "effect"
import { AsyncResult, AtomRegistry } from "effect/reactivity"
import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { GitStatusEntry } from "@ivin/contracts/file"
import type { SubView } from "@ivin/contracts/tab"
import { UiHostProvider, type ChangeListing, type UiHost } from "@ivin/plugin-api/ui"
import { sessionAnnotationsOf } from "../modules/annotation/atoms/list-annotations.ts"
import { projectsAtom } from "../modules/project/atoms/list-projects.ts"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { answerApprovalAtom } from "../modules/session/atoms/answer-approval.ts"
import { answerQuestionAtom } from "../modules/session/atoms/answer-question.ts"
import { openSessionsAtom } from "../modules/session/atoms/open-sessions.ts"
import { useSessionActions } from "../modules/session/hooks/use-session-actions.ts"
import {
  answerApprovalFailure,
  answerQuestionFailure,
} from "../modules/session/rules/failure-message.ts"
import { tabsOf } from "../modules/tab/atoms/list-tabs.ts"
import { openTabAtom } from "../modules/tab/atoms/open-tab.ts"
import { selectedSessionIdAtom } from "../modules/tab/atoms/selected-session-id.ts"
import { folderKey, listFolderOf } from "../modules/file/atoms/list-folder.ts"
import { gitStatusOf } from "../modules/file/atoms/git-status.ts"
import { changesOf } from "../modules/file/atoms/list-changes.ts"
import { changeListingFailure } from "../modules/file/rules/change-listing.ts"
import { listFilesOf } from "../modules/file/atoms/list-files.ts"
import { folderChangesOf } from "../modules/file/atoms/watch-folder.ts"
import { fileListingFailure, folderListingFailure } from "../modules/file/rules/folder-listing.ts"
import { subViewsOf } from "../modules/tab/atoms/list-sub-views.ts"
import { openSubViewAtom } from "../modules/tab/atoms/open-sub-view.ts"
import { openDiffFailure, openFileFailure } from "../modules/tab/rules/sub-view-failure.ts"
import { transcriptOf } from "../modules/transcript/atoms/get-items.ts"
import { settingsAtom } from "../modules/setting/atoms/settings.ts"
import { hostComponents } from "./host-components.ts"
import { showSidebarTab } from "./sidebar.ts"
import { activatePlugin, type UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { useKeyboardHandler } from "../modules/keybinding/hooks/use-keyboard-handler.ts"

const NO_PROJECT = ""
const NO_CHANGES: ReadonlyArray<GitStatusEntry> = []

const LOADING: ChangeListing = { kind: "loading" }

const useProjectPath = () => useAtomValue(selectedProjectAtom)?.path ?? NO_PROJECT

const useOpenSubView = (kind: SubView["kind"]) => {
  const sessions = useAtomValue(openSessionsAtom)
  const open = useAtomSet(openSubViewAtom, { mode: "promiseExit" })
  const failure = kind === "file" ? openFileFailure : openDiffFailure
  return async (sessionId: string, path: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (session === undefined) return failure({ _tag: "SessionNotFound" }, path)
    const exit = await open({
      sessionId,
      workingFolder: session.workingFolder,
      subView: { kind, path },
    })
    return Exit.isFailure(exit) ? failure(Cause.squash(exit.cause), path) : undefined
  }
}

const useSubViewOnScreen = (sessionId: string, kind: SubView["kind"]) => {
  const workingFolder =
    useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)?.workingFolder ?? ""
  const { selected, sessionTabSelected } = useAtomValue(subViewsOf(sessionId, workingFolder).value)
  return sessionTabSelected || selected?.kind !== kind ? null : selected.path
}

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
  useAnnotations: (sessionId, kind) => {
    const annotations = useAtomValue(sessionAnnotationsOf(sessionId).items)
    return useMemo(() => annotations.filter((a) => a.kind === kind), [annotations, kind])
  },
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
  useAnswerQuestion: (sessionId) => {
    const projectPath =
      useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)?.projectPath ?? NO_PROJECT
    const answer = useAtomSet(answerQuestionAtom, { mode: "promiseExit" })
    return async ({ requestId, answers }) => {
      const exit = await answer({ projectPath, sessionId, requestId, answers })
      return Exit.isFailure(exit) ? answerQuestionFailure(Cause.squash(exit.cause)) : undefined
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
  useOpenFile: () => useOpenSubView("file"),
  useListFiles: () => {
    const registry = useContext(RegistryContext)
    return useCallback(
      async (sessionId) => {
        const atom = listFilesOf(sessionId)
        registry.set(atom, { sessionId })
        const exit = await Effect.runPromiseExit(
          AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }),
        )
        return Exit.isSuccess(exit)
          ? { kind: "listed", ...exit.value }
          : fileListingFailure(Cause.squash(exit.cause))
      },
      [registry],
    )
  },
  useFolderChanges: (sessionId, onChange) => {
    const registry = useContext(RegistryContext)
    const changed = useEffectEvent((paths: ReadonlyArray<string>) => onChange(paths))
    useEffect(
      () =>
        registry.subscribe(folderChangesOf(sessionId), (result) => {
          if (AsyncResult.isSuccess(result)) changed(result.value.paths)
        }),
      [registry, sessionId],
    )
  },
  useGitStatus: (sessionId) => {
    const result = useAtomValue(gitStatusOf(sessionId))
    return AsyncResult.isSuccess(result) ? result.value : NO_CHANGES
  },
  useFileOnScreen: (sessionId) => useSubViewOnScreen(sessionId, "file"),
  useChanges: (sessionId) => {
    const atom = changesOf(sessionId)
    const result = useAtomValue(atom)
    const retry = useAtomRefresh(atom)
    const listing: ChangeListing = AsyncResult.isSuccess(result)
      ? result.value
      : AsyncResult.isFailure(result)
        ? changeListingFailure(Cause.squash(result.cause))
        : LOADING
    return { listing, retry }
  },
  useOpenDiff: () => useOpenSubView("diff"),
  useDiffOnScreen: (sessionId) => useSubViewOnScreen(sessionId, "diff"),
  useSettings: () => useAtomValue(settingsAtom),
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
    const deactivations = plugins.map((plugin) =>
      activatePlugin(registry, plugin, (tab) => showSidebarTab(registry, tab, { focus: true })),
    )
    setActive(true)
    return () => {
      deactivations.forEach((deactivate) => deactivate())
      setActive(false)
    }
  }, [registry, plugins])
  return active ? <UiHostProvider host={host}>{children}</UiHostProvider> : null
}
