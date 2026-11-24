import {
  RegistryContext,
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react"
import { Cause, Effect, Exit } from "effect"
import { AsyncResult, AtomRegistry } from "effect/reactivity"
import {
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { GitStatusEntry } from "@ivin/contracts/file"
import type { SubView } from "@ivin/contracts/tab"
import {
  UiHostProvider,
  type ActionFailure,
  type CommittedChangeListing,
  type ChangeListing,
  type Draft,
  type UiHost,
} from "@ivin/plugin-api/ui"
import { sessionAnnotationsOf } from "../modules/annotation/atoms/list-annotations.ts"
import { projectsAtom } from "../modules/project/atoms/list-projects.ts"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { answerApprovalAtom } from "../modules/session/atoms/answer-approval.ts"
import { answerQuestionAtom } from "../modules/session/atoms/answer-question.ts"
import { openSessionsAtom } from "../modules/session/atoms/open-sessions.ts"
import { useSessionActions } from "../modules/session/hooks/use-session-actions.ts"
import { useSessionLocation } from "../modules/session/hooks/use-session-location.ts"
import { draftOf } from "../modules/session/atoms/draft.ts"
import { interruptSessionAtom } from "../modules/session/atoms/interrupt-session.ts"
import { renameFailureOf, renameSessionAtom } from "../modules/session/atoms/rename-session.ts"
import { sendMessageAtom } from "../modules/session/atoms/send-message.ts"
import { sendFailureOf } from "../modules/session/atoms/send-failure.ts"
import { sendNowAtom, sendNowFailureOf } from "../modules/session/atoms/send-now.ts"
import { takeUnreadMessagesAtom } from "../modules/session/atoms/take-unread-messages.ts"
import { setRunOptionsAtom } from "../modules/session/atoms/set-run-options.ts"
import { workingFolderChoiceOf } from "../modules/session/atoms/working-folder-choice.ts"
import {
  answerApprovalFailure,
  answerQuestionFailure,
  setRunOptionsFailure,
} from "../modules/session/rules/failure-message.ts"
import { getHarnessAtom } from "../modules/server/atoms/get-harness.ts"
import { useCommandHandler } from "../modules/command/hooks/use-command-handler.ts"
import { useKeyHint } from "../modules/keybinding/hooks/use-key-hint.ts"
import { tabsOf } from "../modules/tab/atoms/list-tabs.ts"
import { openTabAtom } from "../modules/tab/atoms/open-tab.ts"
import { selectedSessionIdAtom } from "../modules/tab/atoms/selected-session-id.ts"
import { folderKey, listFolderOf } from "../modules/file/atoms/list-folder.ts"
import { gitStatusOf } from "../modules/file/atoms/git-status.ts"
import { changesOf } from "../modules/file/atoms/list-changes.ts"
import { committedChangesOf } from "../modules/file/atoms/list-committed-changes.ts"
import { discardChangesAtom } from "../modules/file/atoms/discard-changes.ts"
import { discardFailure } from "../modules/file/rules/discard-failure.ts"
import { changeListingFailure } from "../modules/file/rules/change-listing.ts"
import { listFilesOf } from "../modules/file/atoms/list-files.ts"
import { folderChangesOf } from "../modules/file/atoms/watch-folder.ts"
import {
  fileListingFailure,
  folderListingFailure,
  gitStatusFailure,
} from "../modules/file/rules/folder-listing.ts"
import { subViewsOf } from "../modules/tab/atoms/list-sub-views.ts"
import { openSubViewAtom } from "../modules/tab/atoms/open-sub-view.ts"
import { openDiffFailure, openFileFailure } from "../modules/tab/rules/sub-view-failure.ts"
import { transcriptOf } from "../modules/transcript/atoms/get-items.ts"
import { usageOf } from "../modules/transcript/atoms/get-usage.ts"
import { settingsAtom } from "../modules/setting/atoms/settings.ts"
import { hostComponents } from "./host-components.ts"
import { showSidebarTab } from "./sidebar.ts"
import { activatePlugin, type UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { importPluginBundle, type ImportBundle } from "../modules/plugin/adapters/plugin-bundle.ts"
import { useUserPlugins } from "../modules/plugin/hooks/use-user-plugins.ts"
import { useKeyboardHandler } from "../modules/keybinding/hooks/use-keyboard-handler.ts"

const NO_PROJECT = ""
const NO_CHANGES: ReadonlyArray<GitStatusEntry> = []

const LOADING = { kind: "loading" } as const satisfies ChangeListing

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

const useOpenSession = (sessionId: string) =>
  useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)

// The session may belong to another project than the one on screen, from the Working panel.
const useSessionProjectPath = (sessionId: string) =>
  useOpenSession(sessionId)?.projectPath ?? NO_PROJECT

const failureOf = <A,>(
  exit: Exit.Exit<A, unknown>,
  describe: (error: unknown) => ActionFailure,
): ActionFailure | undefined =>
  Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)
    ? undefined
    : describe(Cause.squash(exit.cause))

const host: UiHost = {
  useSessions: () => useAtomValue(openSessionsAtom),
  useProjects: () => useAtomValue(projectsAtom.value),
  useSelectedSessionId: () => useAtomValue(selectedSessionIdAtom),
  useSession: useOpenSession,
  useTabs: () => useAtomValue(tabsOf(useProjectPath()).value).tabs,
  useTabsLoaded: () => useAtomValue(tabsOf(useProjectPath()).loaded),
  useOpenTab: () => {
    const openTab = useAtomSet(openTabAtom)
    return (sessionId) => openTab({ sessionId })
  },
  useTranscript: (sessionId) => useAtomValue(transcriptOf(sessionId).list.items),
  useUsage: (sessionId) => {
    const result = useAtomValue(usageOf(sessionId))
    return AsyncResult.isSuccess(result) ? result.value : null
  },
  useAnnotations: (sessionId, kind) => {
    const annotations = useAtomValue(sessionAnnotationsOf(sessionId).items)
    return useMemo(() => annotations.filter((a) => a.kind === kind), [annotations, kind])
  },
  useAnswerApproval: (sessionId) => {
    const projectPath = useSessionProjectPath(sessionId)
    const answer = useAtomSet(answerApprovalAtom, { mode: "promiseExit" })
    return async ({ requestId, allow }) => {
      const exit = await answer({ projectPath, sessionId, requestId, allow })
      return Exit.isFailure(exit) ? answerApprovalFailure(Cause.squash(exit.cause)) : undefined
    }
  },
  useAnswerQuestion: (sessionId) => {
    const projectPath = useSessionProjectPath(sessionId)
    const answer = useAtomSet(answerQuestionAtom, { mode: "promiseExit" })
    return async ({ requestId, answers }) => {
      const exit = await answer({ projectPath, sessionId, requestId, answers })
      return Exit.isFailure(exit) ? answerQuestionFailure(Cause.squash(exit.cause)) : undefined
    }
  },
  useSessionActions,
  useRenameSession: (session) => {
    const rename = useAtomSet(renameSessionAtom)
    const failure = useAtomValue(renameFailureOf(session.id))
    const run = (title: string) =>
      rename({ projectPath: session.projectPath, sessionId: session.id, title })
    return {
      rename: run,
      failure: failure && {
        message: failure.text,
        ...(failure.retryable && { onRetry: () => run(failure.title) }),
      },
    }
  },
  useSessionLocation,
  useDraft: (sessionId) => useAtom(draftOf(sessionId)),
  useSendMessage: (sessionId) => {
    const session = useOpenSession(sessionId)
    const choice = useAtomValue(workingFolderChoiceOf(sessionId))
    const sendMessage = useAtomSet(sendMessageAtom)
    const failure = useAtomValue(sendFailureOf(sessionId))
    const send = (draft: Draft) => {
      const workingFolder = session !== undefined && !session.started ? choice : undefined
      sendMessage({
        projectPath: session?.projectPath ?? NO_PROJECT,
        sessionId,
        draft,
        ...(workingFolder && { workingFolder }),
      })
    }
    return {
      send,
      failure: failure && {
        message: failure.text,
        ...(failure.retryable && { onRetry: () => send(failure.draft) }),
      },
    }
  },
  useTakeUnreadMessages: (sessionId) => {
    const session = useOpenSession(sessionId)
    const take = useAtomSet(takeUnreadMessagesAtom)
    const ids = session?.unreadMessages.map((message) => message.id).join(",")
    useEffect(() => {
      if (session === undefined) return
      take({
        sessionId,
        lastImageNumber: session.lastImageNumber,
        messages: session.unreadMessages,
      })
    }, [sessionId, ids, session !== undefined])
  },
  useInterruptSession: (sessionId) => {
    const projectPath = useSessionProjectPath(sessionId)
    const interrupt = useAtomSet(interruptSessionAtom)
    return () => interrupt({ projectPath, sessionId })
  },
  useSendNow: (sessionId) => {
    const projectPath = useSessionProjectPath(sessionId)
    const run = useAtomSet(sendNowAtom)
    const failure = useAtomValue(sendNowFailureOf(sessionId))
    const sendNow = () => run({ projectPath, sessionId })
    return {
      sendNow,
      failure: failure && {
        message: failure.text,
        ...(failure.retryable && { onRetry: sendNow }),
      },
    }
  },
  useOfferedRunOptions: (sessionId) => {
    const harness = useOpenSession(sessionId)?.harness
    const server = AsyncResult.getOrElse(useAtomValue(getHarnessAtom), () => null)
    return harness !== undefined && server?.id === harness ? server.runOptions : null
  },
  useSetRunOptions: (sessionId) => {
    const projectPath = useSessionProjectPath(sessionId)
    const set = useAtomSet(setRunOptionsAtom, { mode: "promiseExit" })
    return async (options) =>
      failureOf(await set({ projectPath, sessionId, options }), (error) =>
        setRunOptionsFailure(error, options),
      )
  },
  useCommandHandler,
  useKeyHint,
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
  useGitStatusFailure: (sessionId) => {
    const atom = gitStatusOf(sessionId)
    const result = useAtomValue(atom)
    const retry = useAtomRefresh(atom)
    return {
      failure: AsyncResult.isFailure(result) ? gitStatusFailure(Cause.squash(result.cause)) : null,
      retry,
    }
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
  useCommittedChanges: (sessionId) => {
    const atom = committedChangesOf(sessionId)
    const result = useAtomValue(atom)
    const retry = useAtomRefresh(atom)
    const listing: CommittedChangeListing = AsyncResult.isSuccess(result)
      ? result.value
      : AsyncResult.isFailure(result)
        ? changeListingFailure(Cause.squash(result.cause))
        : LOADING
    return { listing, retry }
  },
  useOpenCommittedDiff: () => useOpenSubView("committed_diff"),
  useCommittedDiffOnScreen: (sessionId) => useSubViewOnScreen(sessionId, "committed_diff"),
  useDiscardChanges: () => {
    const discard = useAtomSet(discardChangesAtom, { mode: "promiseExit" })
    return async (sessionId, paths) => {
      const exit = await discard({ sessionId, paths })
      return Exit.isFailure(exit) ? discardFailure(Cause.squash(exit.cause), paths) : undefined
    }
  },
  components: hostComponents,
}

export function PluginsProvider({
  plugins,
  importBundle = importPluginBundle,
  children,
}: {
  plugins: ReadonlyArray<UiPluginEntry>
  importBundle?: ImportBundle
  children: ReactNode
}) {
  const registry = useContext(RegistryContext)
  useKeyboardHandler()
  const userPlugins = useUserPlugins(importBundle)
  // A user plugin replaces the built-in plugin with its id.
  const all = useMemo(() => {
    const userIds = new Set(userPlugins.plugins.map((plugin) => plugin.manifest.id))
    return [...plugins.filter((plugin) => !userIds.has(plugin.manifest.id)), ...userPlugins.plugins]
  }, [plugins, userPlugins.plugins])
  const { dropFailedPlugin } = userPlugins
  const deactivations = useRef(new Map<UiPluginEntry, () => void>())
  // Children wait for activation so a virtual list never measures rows that have no contributions yet.
  const [active, setActive] = useState(false)
  useEffect(() => {
    const current = deactivations.current
    for (const [plugin, deactivate] of current) {
      if (all.includes(plugin)) continue
      deactivate()
      current.delete(plugin)
    }
    for (const plugin of all) {
      if (current.has(plugin)) continue
      const showPanel = (tab: string) => showSidebarTab(registry, tab, { focus: true })
      let failed = false
      const onFailure = userPlugins.plugins.includes(plugin)
        ? (error: unknown) => {
            failed = true
            dropFailedPlugin(plugin, error)
            // Back in the same pass, so the replaced built-in plugin never leaves the screen.
            const builtIn = plugins.find((p) => p.manifest.id === plugin.manifest.id)
            if (builtIn !== undefined && !current.has(builtIn))
              current.set(builtIn, activatePlugin(registry, builtIn, showPanel))
          }
        : undefined
      const deactivate = activatePlugin(registry, plugin, showPanel, onFailure)
      // Deactivating a failed plugin would remove its replaced built-in plugin's contributions, which share its id.
      if (!failed) current.set(plugin, deactivate)
    }
    setActive(true)
  }, [registry, all, plugins, userPlugins.plugins, dropFailedPlugin])
  useEffect(
    () => () => {
      deactivations.current.forEach((deactivate) => deactivate())
      deactivations.current.clear()
      setActive(false)
    },
    [registry],
  )
  return active ? <UiHostProvider host={host}>{children}</UiHostProvider> : null
}
