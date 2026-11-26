import {
  RegistryContext,
  useAtom,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react"
import { Cause, Effect, Exit } from "effect"
import { AsyncResult, AtomRegistry, type Atom } from "effect/reactivity"
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
import type { AgentCommand, Harness } from "@ivin/contracts/session"
import {
  UiHostProvider,
  type ActionFailure,
  type AgentCommandListing,
  type ChangeListing,
  type CommittedChangeListing,
  type Draft,
  type UiHost,
} from "@ivin/plugin-api/ui"
import { sessionAnnotationsOf } from "../modules/annotation/atoms/list-annotations.ts"
import { projectsAtom } from "../modules/project/atoms/list-projects.ts"
import { selectedProjectAtom } from "../modules/project/atoms/selected-project.ts"
import { answerApprovalAtom } from "../modules/session/atoms/answer-approval.ts"
import { answerQuestionAtom } from "../modules/session/atoms/answer-question.ts"
import { serverStateAtom } from "../modules/server/atoms/server-state.ts"
import { sessionsOf } from "../modules/session/atoms/list-sessions.ts"
import { openSessionsAtom } from "../modules/session/atoms/open-sessions.ts"
import {
  useAllSessionsActions,
  useSessionActions,
} from "../modules/session/hooks/use-session-actions.ts"
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
import { agentCommandsOf } from "../modules/session/atoms/list-agent-commands.ts"
import { agentCommandsFailure } from "../modules/session/rules/agent-commands.ts"
import { HARNESSES } from "../modules/session/rules/harnesses.ts"
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
import { runOpenView } from "../modules/view/atoms/open-view.ts"
import {
  openDiffFailure,
  openFileFailure,
  openViewFailure,
} from "../modules/tab/rules/sub-view-failure.ts"
import {
  pendingApprovalOf,
  pendingQuestionOf,
} from "../modules/transcript/atoms/get-pending-items.ts"
import { usageOf } from "../modules/transcript/atoms/get-usage.ts"
import { settingsWithPluginsAtom } from "../modules/setting/atoms/settings.ts"
import { contractSession } from "../modules/session/rules/plugin-session.ts"
import { hostComponents } from "./host-components.ts"
import { showSidebarTab } from "./sidebar.ts"
import { activatePlugin, type UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"
import { useBuiltinPlugins } from "../modules/plugin/hooks/use-builtin-plugins.ts"
import { importPluginBundle, type ImportBundle } from "../modules/plugin/adapters/plugin-bundle.ts"
import { useUserPlugins } from "../modules/plugin/hooks/use-user-plugins.ts"
import { useKeyboardHandler } from "../modules/keybinding/hooks/use-keyboard-handler.ts"
import { taskOf } from "../modules/transcript/atoms/background-tasks.ts"
import { useTaskOutput } from "../modules/transcript/hooks/use-task-output.ts"

const NO_PROJECT = ""
const NO_CHANGES: ReadonlyArray<GitStatusEntry> = []

const LOADING = { kind: "loading" } as const satisfies ChangeListing

const useProjectPath = () => useAtomValue(selectedProjectAtom)?.path ?? NO_PROJECT

// A watch feed never succeeds, so a failure that is waiting again means it is running.
const hasFailed = (status: AsyncResult.AsyncResult<unknown, unknown> | undefined) =>
  status !== undefined && AsyncResult.isFailure(status) && !status.waiting

const useSessionListStatus = (): ReturnType<UiHost["useSessionListStatus"]> => {
  const path = useProjectPath()
  const loaded = useAtomValue(tabsOf(path).loaded)
  const tabsFailed = hasFailed(useAtomValue(tabsOf(path).status))
  const sessionsFailed = hasFailed(useAtomValue(sessionsOf(path).status))
  // A stopped server is reported by the window; the feeds start again with its new client.
  const serverRunning = useAtomValue(serverStateAtom).kind === "running"
  const retryTabs = useAtomRefresh(tabsOf(path).status)
  const retrySessions = useAtomRefresh(sessionsOf(path).status)
  return {
    loaded,
    failed: serverRunning && (tabsFailed || sessionsFailed),
    retry: () => {
      if (tabsFailed) retryTabs()
      if (sessionsFailed) retrySessions()
    },
  }
}

const useOpenView = (): ReturnType<UiHost["useOpenView"]> => {
  const registry = useContext(RegistryContext)
  return useCallback(
    (sessionId, view, params, options) =>
      runOpenView(registry, { sessionId, view, params, placement: options?.placement }, (error) =>
        openViewFailure(error, view),
      ),
    [registry],
  )
}

const useSubViewOnScreen = (sessionId: string) => {
  const workingFolder = useWorkingFolderOf(sessionId)
  const { selected, sessionTabSelected } = useAtomValue(subViewsOf(sessionId, workingFolder).value)
  return sessionTabSelected ? null : selected
}

const agentCommandListing = (
  result: AsyncResult.AsyncResult<ReadonlyArray<AgentCommand> | null, unknown>,
  harness: Harness | undefined,
): AgentCommandListing => {
  if (AsyncResult.isSuccess(result))
    return result.value === null ? { kind: "none" } : { kind: "listed", commands: result.value }
  if (AsyncResult.isFailure(result) && !result.waiting)
    return {
      kind: "failed",
      failure: agentCommandsFailure(harness === undefined ? "the agent" : HARNESSES[harness].name),
    }
  return { kind: "loading" }
}

const useOpenSession = (sessionId: string) =>
  useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)

const useWorkingFolderOf = (sessionId: string) => useOpenSession(sessionId)?.workingFolder ?? ""

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
  useSessionListStatus,
  useOpenTab: () => {
    const openTab = useAtomSet(openTabAtom)
    return (sessionId) => openTab({ sessionId })
  },
  usePendingApproval: (sessionId) => useAtomValue(pendingApprovalOf(sessionId)),
  usePendingQuestion: (sessionId) => useAtomValue(pendingQuestionOf(sessionId)),
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
  useSessionActions: (session) => useSessionActions(contractSession(session)),
  useAllSessionsActions: (sessions) => useAllSessionsActions(sessions.map(contractSession)),
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
  useSessionLocation: (session) => useSessionLocation(contractSession(session)),
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
  useOpenView,
  useOpenFile: () => {
    const registry = useContext(RegistryContext)
    return useCallback(
      (sessionId, path) =>
        runOpenView(registry, { sessionId, view: "files/file", params: { path } }, (error) =>
          openFileFailure(error, path),
        ),
      [registry],
    )
  },
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
    const workingFolder = useWorkingFolderOf(sessionId)
    const changed = useEffectEvent((paths: ReadonlyArray<string>) => onChange(paths))
    useEffect(
      () =>
        registry.subscribe(folderChangesOf(sessionId, workingFolder), (result) => {
          if (AsyncResult.isSuccess(result)) changed(result.value.paths)
        }),
      [registry, sessionId, workingFolder],
    )
  },
  useAgentCommands: (sessionId) => {
    const session = useOpenSession(sessionId)
    const atom = agentCommandsOf(sessionId)
    const result = useAtomValue(atom)
    const refresh = useAtomRefresh(atom)
    return { listing: agentCommandListing(result, session?.harness), refresh }
  },
  useGitStatus: (sessionId) => {
    const atom = gitStatusOf(sessionId, useWorkingFolderOf(sessionId))
    const result = useAtomValue(atom)
    const retry = useAtomRefresh(atom)
    return {
      entries: AsyncResult.isSuccess(result) ? result.value : NO_CHANGES,
      failure: AsyncResult.isFailure(result) ? gitStatusFailure(Cause.squash(result.cause)) : null,
      retry,
    }
  },
  useFileOnScreen: (sessionId) => {
    const selected = useSubViewOnScreen(sessionId)
    const path = selected?.params["path"]
    return selected?.view === "files/file" && typeof path === "string" ? path : null
  },
  useChanges: (sessionId, kind) => {
    const workingFolder = useWorkingFolderOf(sessionId)
    const atom = (
      kind === "committed"
        ? committedChangesOf(sessionId, workingFolder)
        : changesOf(sessionId, workingFolder)
    ) as Atom.Atom<AsyncResult.AsyncResult<CommittedChangeListing, unknown>>
    const result = useAtomValue(atom)
    const retry = useAtomRefresh(atom)
    const listing = AsyncResult.isSuccess(result)
      ? result.value
      : AsyncResult.isFailure(result)
        ? changeListingFailure(Cause.squash(result.cause))
        : LOADING
    return { listing, retry } as never
  },
  useOpenDiff: () => {
    const registry = useContext(RegistryContext)
    return useCallback(
      (sessionId, path, kind) =>
        runOpenView(
          registry,
          { sessionId, view: "changes/diff", params: { path, kind } },
          (error) => openDiffFailure(error, path),
        ),
      [registry],
    )
  },
  useDiffOnScreen: (sessionId) => {
    const selected = useSubViewOnScreen(sessionId)
    const { path, kind } = selected?.params ?? {}
    return selected?.view === "changes/diff" &&
      typeof path === "string" &&
      (kind === "working" || kind === "committed")
      ? { path, kind }
      : null
  },
  useTask: (sessionId, taskId) => useAtomValue(taskOf(sessionId)(taskId)),
  useTaskOutput,
  useSettings: () => useAtomValue(settingsWithPluginsAtom),
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
  plugins: given,
  importBundle = importPluginBundle,
  children,
}: {
  // The built-in plugins, when the window holds them itself rather than importing those the server lists.
  plugins?: ReadonlyArray<UiPluginEntry>
  importBundle?: ImportBundle
  children: ReactNode
}) {
  const registry = useContext(RegistryContext)
  useKeyboardHandler()
  const builtins = useBuiltinPlugins(importBundle, given === undefined)
  const plugins = given ?? builtins.plugins
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
    if (builtins.ready) setActive(true)
  }, [registry, all, plugins, userPlugins.plugins, dropFailedPlugin, builtins.ready])
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
