import { DateTime, Effect, Layer, PubSub, Stream } from "effect"
import {
  type Annotation,
  type AnnotationChange,
  AnnotationNotFound,
  annotationKinds,
  type AnnotationTarget,
} from "@ivin/contracts/annotation"
import type { ShellCommandNotOurs, ShellFoldersRefused, ShellInstall } from "@ivin/contracts/cli"
import {
  FileChangedOnDisk,
  FileNotRead,
  GitFailed,
  type CommittedChangeList,
  type ChangeList,
  type FileDiff,
  FileNotWritten,
  FolderNotListed,
  type FileContent,
  type FileList,
  type FolderChange,
  type FolderEntry,
  type GitStatusEntry,
} from "@ivin/contracts/file"
import type { UserKeybindings } from "@ivin/contracts/keybinding"
import type { ErrorReport } from "@ivin/contracts/log"
import type { PluginFailure, UserPlugin } from "@ivin/contracts/plugin"
import type { OpenProjects, Project } from "@ivin/contracts/project"
import type {
  Harness,
  HarnessRunOptions,
  RelaunchFailure,
  RunOptions,
  Session,
  SessionChange,
  SessionStatus,
  WorkingFolderChoice,
} from "@ivin/contracts/session"
import { defaultSettings, SettingsFileInvalid, type UserSettings } from "@ivin/contracts/setting"
import type { ProjectTabs, SubView, TabSubViews } from "@ivin/contracts/tab"
import type {
  ImageData,
  QuestionAnswer,
  TranscriptItem,
  TranscriptItemChange,
  RunOption,
} from "@ivin/contracts/transcript"
import type { Branch, CheckoutStatus, Worktree } from "@ivin/contracts/worktree"
import { ProjectNotOpen } from "@ivin/contracts/project"
import {
  CheckoutHasLocalChanges,
  CheckoutRefused,
  GitRefused,
  type LocalChangesChoice,
  SessionNotFound,
  WorkingFolderDeleted,
  WorktreeNotCreated,
} from "@ivin/contracts/session"
import {
  noSubViews,
  withFullWidth,
  withSessionTabSelected,
  withSubViewClosed,
  withSubViewOpen,
} from "../modules/tab/rules/sub-views.ts"
import { ServerClient } from "./server-client.ts"

export interface FakeServer {
  readonly layer: Layer.Layer<ServerClient>
  readonly sessions: Map<string, Session>
  readonly errorReports: Array<ErrorReport>
  readonly userPlugins: Array<UserPlugin>
  readonly pluginFailures: Array<PluginFailure>
  // Adds an item to a transcript as the server would, and streams it to watchers.
  readonly pushItem: (item: TranscriptItem) => void
  // Streams any change (a delta, say) to watchers without storing it.
  readonly pushChange: (change: TranscriptItemChange) => void
  // Changes a session's status as the server would, and streams it to `session.watch`.
  readonly setStatus: (sessionId: string, status: SessionStatus) => void
  // Marks the first turn after a change of run options as failed, as the server would.
  readonly failRelaunch: (sessionId: string, failure: RelaunchFailure) => void
  readonly seedItems: (sessionId: string, items: ReadonlyArray<TranscriptItem>) => void
  // The agent takes the session's pending messages into its running turn, as steers.
  readonly readPendingMessages: (sessionId: string) => void
  readonly sentMessages: ReadonlyArray<{
    readonly text: string
    readonly images?: ReadonlyArray<ImageData>
    readonly workingFolder?: WorkingFolderChoice
  }>
  readonly pickedFolders: ReadonlyArray<WorkingFolderChoice>
  // What `worktree.list` returns, for every project.
  readonly worktrees: Array<Worktree>
  // The project checkout as `worktree.checkoutStatus` reports it; switching and pulling change it.
  readonly checkout: FakeCheckout
  readonly localChangesChoices: ReadonlyArray<LocalChangesChoice | "stash before pull">
  // What `worktree.listBranches` returns: the local ones at once, the remote ones once fetched.
  readonly branches: Array<Branch>
  // Makes the next fetch of origin wait until `release` is called, or fail.
  readonly holdNextFetch: () => { readonly release: () => void; readonly fail: () => void }
  // Makes every pickBranch fail as git would, with this message; null picks again.
  readonly failCheckoutWith: (gitMessage: string | null) => void
  // Makes every sendMessage fail as git would, storing this message; null sends again.
  readonly failWorktreeWith: (gitMessage: string | null) => void
  // Makes the next sendMessage wait until `release` is called, or fail.
  readonly holdNextSend: () => { readonly release: () => void; readonly fail: () => void }
  // Makes the next tab.reorder wait until `release` is called, or fail.
  readonly holdNextReorder: () => { readonly release: () => void; readonly fail: () => void }
  // Opens a project, or a session's tab, as the server would.
  readonly openProject: (path: string) => void
  readonly openTab: (sessionId: string) => void
  // Makes the next tab.list wait until `release` is called.
  readonly holdNextTabList: () => { readonly release: () => void }
  readonly tabOrder: (projectPath: string) => ReadonlyArray<string>
  // Streams the user's keybindings to `keybinding.watch`, as after a change to the file.
  readonly setUserKeybindings: (state: UserKeybindings) => void
  // Makes the next call of this RPC die, as a lost connection would.
  readonly failNextCall: (rpc: string) => void
  // Makes the next call of this RPC wait until `release` is called, or die as `failNextCall`.
  readonly holdNextCall: (rpc: string) => {
    readonly release: () => void
    readonly fail: () => void
  }
  // What `file.listFolder` lists, by absolute folder path; a session whose working folder is
  // missing here has had it deleted.
  readonly folders: Map<string, ReadonlyArray<FolderEntry>>
  readonly listedFolders: ReadonlyArray<string>
  // What `file.gitStatus` returns, by working folder.
  readonly gitStatus: Map<string, ReadonlyArray<GitStatusEntry>>
  // What `file.listChanges` returns, by working folder; a `gitMessage` makes it fail as git would.
  // None listed when missing here.
  readonly changes: Map<string, ChangeList | { readonly gitMessage: string }>
  // What `file.readDiff` returns, by absolute path; `unchanged` when missing here.
  readonly diffs: Map<string, FileDiff>
  // What `file.listCommittedChanges` returns, by working folder; a `gitMessage` makes it fail.
  // None listed when missing here.
  readonly committedChanges: Map<string, CommittedChangeList | { readonly gitMessage: string }>
  // What `file.readCommittedDiff` returns, by absolute path; `unchanged` when missing here.
  readonly committedDiffs: Map<string, FileDiff>
  // `file.discardChanges` fails with this git message when given one of these absolute paths;
  // otherwise it drops the paths from `changes` and streams them to `file.watch`.
  readonly discardFailures: Map<string, string>
  // `file.listFiles` lists the files of `folders` that git does not ignore; this many times so far.
  readonly fileListings: () => number
  // Streams paths changed on disk to `file.watch` for that working folder; change `folders` first.
  readonly changeOnDisk: (workingFolder: string, paths: ReadonlyArray<string>) => void
  // What `file.readFile` reads, by absolute path; a path missing here has no file. A text's
  // version is the text itself.
  readonly files: Map<string, FakeFile>
  // Makes the writes of `file.writeFile` fail as a file that cannot be written.
  unwritable: boolean
  // Makes the next file.readFile wait until `release` is called.
  readonly holdNextRead: () => { readonly release: () => void }
  // Each session's sub-views, as `tab.listSubViews` returns them.
  readonly subViews: Map<string, TabSubViews>
  // Streams the user's settings to `setting.watch`, as after a change to the file.
  readonly setUserSettings: (state: UserSettings) => void
  readonly shell: FakeShell
}

export type FakeFile =
  | { readonly kind: "text"; readonly text: string }
  | Exclude<FileContent, { kind: "text" }>
  | "unreadable"

export interface FakeShell {
  // What `cli.getShellInstall` returns.
  installed: ShellInstall | null
  // What the next `cli.installInShell` does: install there, or fail with this error.
  nextInstall: ShellInstall | ShellFoldersRefused | ShellCommandNotOurs
}

export interface FakeCheckout extends CheckoutStatus {
  dirty: boolean
  // Git's refusal for the next pull while the checkout is dirty; null pulls.
  pullRefusal: string | null
}

const offer = (value: string, name: string, description: string | null = null) => ({
  value,
  name,
  description,
})
const ALL_EFFORTS = ["low", "medium", "high", "xhigh"]

export const fakeRunOptions: HarnessRunOptions = {
  model: {
    values: [
      {
        ...offer("sonnet", "Sonnet 5.5", "For everyday tasks"),
        efforts: ALL_EFFORTS,
        older: false,
      },
      { ...offer("opus", "Opus 5.5"), efforts: ALL_EFFORTS, older: false },
      { ...offer("haiku", "Haiku 5.5"), efforts: ALL_EFFORTS, older: false },
      { ...offer("claude-opus-4-6", "Opus 4.6"), efforts: ["low", "medium", "high"], older: true },
      { ...offer("claude-haiku-4-5", "Haiku 4.5"), efforts: [], older: true },
    ],
    default: "sonnet",
  },
  effort: {
    values: [
      offer("low", "Low"),
      offer("medium", "Medium"),
      offer("high", "High"),
      offer("xhigh", "Extra high"),
    ],
    default: "high",
  },
  permissionMode: {
    values: [
      offer("manual", "Manual", "Asks before edits and commands"),
      offer("acceptEdits", "Accept edits", "Edits files without asking"),
      offer("plan", "Plan", "Reads and plans, changes nothing"),
    ],
    default: "manual",
  },
}

const fakeNameOf = (option: RunOption, value: string) =>
  fakeRunOptions[option].values.find((offered) => offered.value === value)?.name ?? value

export const makeFakeServer = (
  options: {
    readonly project?: Project
    readonly harness?: Harness
    readonly runOptions?: HarnessRunOptions
  } = {},
): FakeServer => {
  const harness = options.harness ?? "claude"
  const runOptions = options.runOptions ?? fakeRunOptions
  let projects: Array<Project> = options.project ? [options.project] : []
  let selectedPath: string | null = options.project?.path ?? null
  let tabs: Array<{ sessionId: string; projectPath: string }> = []
  const selectedTab = new Map<string, string | null>()
  const sessions = new Map<string, Session>()
  const transcripts = new Map<string, Array<TranscriptItem>>()
  const pubsub = Effect.runSync(PubSub.unbounded<TranscriptItemChange>())
  const sessionChanges = Effect.runSync(PubSub.unbounded<SessionChange>())
  const annotations = new Map<string, Annotation>()
  const annotationChanges = Effect.runSync(PubSub.unbounded<AnnotationChange>())
  let userKeybindings: UserKeybindings = { keybindings: [], problem: null }
  const keybindingChanges = Effect.runSync(PubSub.unbounded<UserKeybindings>())
  let userSettings: UserSettings = { settings: defaultSettings, problem: null }
  const settingChanges = Effect.runSync(PubSub.unbounded<UserSettings>())
  const shell: FakeShell = {
    installed: null,
    nextInstall: { folder: "/usr/local/bin", path: "/usr/local/bin/ivin", onPath: true },
  }
  let clock = 1_000
  let nextId = 1
  let hold: { readonly wait: Promise<boolean> } | null = null
  let holdReorder: { readonly wait: Promise<boolean> } | null = null
  let holdTabList: Promise<void> | null = null
  const errorReports: Array<ErrorReport> = []
  const userPlugins: Array<UserPlugin> = []
  const pluginFailures: Array<PluginFailure> = []
  const folders = new Map<string, ReadonlyArray<FolderEntry>>()
  const gitStatus = new Map<string, ReadonlyArray<GitStatusEntry>>()
  const changes = new Map<string, ChangeList | { readonly gitMessage: string }>()
  const diffs = new Map<string, FileDiff>()
  const committedChanges = new Map<string, CommittedChangeList | { readonly gitMessage: string }>()
  const committedDiffs = new Map<string, FileDiff>()
  const discardFailures = new Map<string, string>()
  let fileListings = 0
  const diskChanges = Effect.runSync(
    PubSub.unbounded<{ readonly workingFolder: string; readonly change: FolderChange }>(),
  )
  const filesUnder = (folder: string, prefix: string): Array<string> =>
    (folders.get(folder) ?? [])
      .filter((entry) => !entry.ignored)
      .flatMap((entry) =>
        entry.kind === "file"
          ? [prefix + entry.name]
          : filesUnder(`${folder}/${entry.name}`, `${prefix}${entry.name}/`),
      )
  const listedFolders: Array<string> = []
  const files = new Map<string, FakeFile>()
  let holdRead: Promise<void> | null = null
  const subViews = new Map<string, TabSubViews>()
  const subViewsOf = (sessionId: string): TabSubViews =>
    subViews.get(sessionId) ?? noSubViews(sessionId)
  const withSession = <A>(sessionId: string, run: () => A) =>
    Effect.suspend(() =>
      sessions.has(sessionId)
        ? Effect.succeed(run())
        : Effect.fail(new SessionNotFound({ sessionId })),
    )
  const failing = new Set<string>()
  const holding = new Map<string, Promise<boolean>>()
  const sentMessages: Array<FakeServer["sentMessages"][number]> = []
  const pickedFolders: Array<WorkingFolderChoice> = []
  let worktreeFailure: string | null = null
  const worktrees: Array<Worktree> = []
  const checkout: FakeCheckout = {
    branch: "main",
    defaultBranch: "main",
    defaultBranchInWorktree: false,
    behind: 0,
    dirty: false,
    pullRefusal: null,
  }
  const localChangesChoices: Array<LocalChangesChoice | "stash before pull"> = []
  const checkoutStatus = (): CheckoutStatus => ({
    branch: checkout.branch,
    defaultBranch: checkout.defaultBranch,
    defaultBranchInWorktree: checkout.defaultBranchInWorktree,
    behind: checkout.behind,
  })
  const branches: Array<Branch> = []
  let holdFetch: Promise<boolean> | null = null
  let checkoutFailure: string | null = null

  const openProjects = (): OpenProjects => ({ projects: [...projects], selectedPath })
  const tabsOf = (projectPath: string) => tabs.filter((tab) => tab.projectPath === projectPath)
  const projectTabs = (projectPath: string): ProjectTabs => ({
    projectPath,
    tabs: tabsOf(projectPath),
    selectedSessionId: selectedTab.get(projectPath) ?? null,
  })
  const projectOr = <A>(path: string, run: () => A) =>
    Effect.suspend(() =>
      projects.some((p) => p.path === path)
        ? Effect.succeed(run())
        : Effect.fail(new ProjectNotOpen({ path })),
    )
  const tick = () => DateTime.makeUnsafe((clock += 1_000))
  const itemsOf = (sessionId: string) => {
    const items = transcripts.get(sessionId) ?? []
    transcripts.set(sessionId, items)
    return items
  }
  const publish = (item: TranscriptItem) => {
    itemsOf(item.sessionId).push(item)
    Effect.runSync(PubSub.publish(pubsub, { type: "upsert", item }))
  }

  const readMessages = (session: Session, steer: boolean) => {
    for (const message of session.pendingMessages) {
      publish({
        ...message,
        sessionId: session.id,
        position: itemsOf(session.id).length,
        at: 0,
        type: "message",
        role: "user",
        steer,
      })
    }
    saveSession({ ...sessions.get(session.id)!, pendingMessages: [] })
  }
  const saveSession = (changed: Session) => {
    const before = sessions.get(changed.id)
    const session =
      before && before.status !== changed.status ? { ...changed, statusChangedAt: tick() } : changed
    sessions.set(session.id, session)
    const change: SessionChange =
      session.archivedAt === null
        ? { _tag: "changed", session }
        : { _tag: "removed", sessionId: session.id, projectPath: session.projectPath }
    Effect.runSync(PubSub.publish(sessionChanges, change))
    return session
  }
  const removeTab = (session: Session) => {
    const index = tabsOf(session.projectPath).findIndex((tab) => tab.sessionId === session.id)
    tabs = tabs.filter((tab) => tab.sessionId !== session.id)
    if (index >= 0 && selectedTab.get(session.projectPath) === session.id) {
      const rest = tabsOf(session.projectPath)
      selectedTab.set(session.projectPath, (rest[index] ?? rest[index - 1])?.sessionId ?? null)
    }
    return index >= 0
  }
  const sameTarget = (a: AnnotationTarget, b: AnnotationTarget) =>
    JSON.stringify(a) === JSON.stringify(b)
  const annotationsOf = (target: AnnotationTarget) =>
    [...annotations.values()].filter((annotation) => sameTarget(annotation.target, target))
  const keyOf = (kind: string, data: unknown) =>
    Object.hasOwn(annotationKinds, kind)
      ? (data as Record<string, unknown>)[annotationKinds[kind as keyof typeof annotationKinds].key]
      : undefined
  const removeAnnotation = (annotation: Annotation) => {
    annotations.delete(annotation.id)
    Effect.runSync(
      PubSub.publish(annotationChanges, {
        _tag: "removed",
        id: annotation.id,
        target: annotation.target,
      }),
    )
  }
  const existing = (sessionId: string) =>
    Effect.suspend(() => {
      const session = sessions.get(sessionId)
      return session ? Effect.succeed(session) : Effect.fail(new SessionNotFound({ sessionId }))
    })

  const getItems = ({
    sessionId,
    position,
    before,
    after,
  }: {
    sessionId: string
    position: number | null
    before: number
    after: number
  }) =>
    Effect.sync(() => {
      const items = itemsOf(sessionId)
      const anchor =
        position === null ? items.length : items.findIndex((i) => i.position >= position)
      const start = Math.max(0, anchor - before)
      const end = position === null ? items.length : Math.min(items.length, anchor + after)
      return {
        items: items.slice(start, end),
        hasBefore: start > 0,
        hasAfter: end < items.length,
      }
    })

  const client = {
    "server.getVersion": () => Effect.succeed({ version: "0.0.0" }),
    "server.getHarness": () => Effect.succeed({ id: harness, runOptions }),
    "log.writeError": (report: ErrorReport) => Effect.sync(() => void errorReports.push(report)),
    "plugin.list": () => Effect.sync(() => [...userPlugins]),
    "plugin.reportFailure": (failure: PluginFailure) =>
      Effect.sync(() => void pluginFailures.push(failure)),
    "plugin.readLog": ({ id }: { id: string }) =>
      Effect.sync(() => pluginFailures.filter((f) => f.id === id).map((f) => f.reason)),
    "keybinding.watch": () =>
      Stream.unwrap(
        Effect.map(PubSub.subscribe(keybindingChanges), (subscription) =>
          Stream.make(userKeybindings).pipe(Stream.concat(Stream.fromSubscription(subscription))),
        ),
      ),
    "cli.getShellInstall": () => Effect.sync(() => shell.installed),
    "cli.installInShell": () =>
      Effect.suspend(() => {
        const next = shell.nextInstall
        if ("_tag" in next) return Effect.fail(next)
        shell.installed = next
        return Effect.succeed(next)
      }),
    "setting.watch": () =>
      Stream.unwrap(
        Effect.map(PubSub.subscribe(settingChanges), (subscription) =>
          Stream.make(userSettings).pipe(Stream.concat(Stream.fromSubscription(subscription))),
        ),
      ),
    // Refuses while the file has a problem, as the server cannot edit a file it cannot parse.
    "setting.set": ({ path, value }: { path: string; value: unknown }) =>
      userSettings.problem !== null
        ? Effect.fail(
            new SettingsFileInvalid({
              path: "~/.ivin/settings.json",
              reason: "notJson",
              parseError: null,
            }),
          )
        : Effect.sync(() => {
            const [section, key] = path.split(".") as [string, string]
            const settings = structuredClone(userSettings.settings) as Record<
              string,
              Record<string, unknown>
            >
            settings[section]![key] = value
            userSettings = { settings: settings as UserSettings["settings"], problem: null }
            Effect.runSync(PubSub.publish(settingChanges, userSettings))
          }),
    "project.list": () => Effect.sync(openProjects),
    "project.open": ({ path }: { path: string }) =>
      Effect.sync(() => {
        if (!projects.some((p) => p.path === path)) {
          projects.push({ path, name: path.split("/").at(-1)!, lastOpenedAt: tick() })
        }
        selectedPath = path
        return openProjects()
      }),
    "project.select": ({ path }: { path: string }) =>
      projectOr(path, () => {
        selectedPath = path
        return openProjects()
      }),
    "project.close": ({ path }: { path: string }) =>
      projectOr(path, () => {
        const index = projects.findIndex((p) => p.path === path)
        projects = projects.filter((p) => p.path !== path)
        tabs = tabs.filter((tab) => tab.projectPath !== path)
        selectedTab.delete(path)
        if (selectedPath === path)
          selectedPath = (projects[index] ?? projects[index - 1])?.path ?? null
        return openProjects()
      }),
    "tab.list": ({ projectPath }: { projectPath: string }) =>
      Effect.promise(async () => {
        await holdTabList
        return projectTabs(projectPath)
      }),
    "tab.open": ({ sessionId }: { sessionId: string }) =>
      Effect.suspend((): Effect.Effect<ProjectTabs, SessionNotFound | ProjectNotOpen> => {
        const session = sessions.get(sessionId)
        if (!session) return Effect.fail(new SessionNotFound({ sessionId }))
        return projectOr(session.projectPath, () => {
          if (!tabs.some((tab) => tab.sessionId === sessionId)) {
            tabs.push({ sessionId, projectPath: session.projectPath })
          }
          selectedTab.set(session.projectPath, sessionId)
          return projectTabs(session.projectPath)
        })
      }),
    "tab.close": ({ sessionId }: { sessionId: string }) =>
      Effect.suspend(() => {
        const session = sessions.get(sessionId)
        if (!session) return Effect.fail(new SessionNotFound({ sessionId }))
        if (
          removeTab(session) &&
          userSettings.settings.tabs.stopAgentOnClose &&
          (session.status === "working" || session.status === "waiting")
        ) {
          saveSession({ ...session, status: "idle" })
        }
        return Effect.succeed(projectTabs(session.projectPath))
      }),
    "tab.reorder": ({
      projectPath,
      sessionIds,
    }: {
      projectPath: string
      sessionIds: ReadonlyArray<string>
    }) =>
      Effect.promise(async () => {
        if (holdReorder) {
          const ok = await holdReorder.wait
          holdReorder = null
          if (!ok) throw new Error("reorder failed")
        }
        const bar = tabsOf(projectPath)
        const named = sessionIds.flatMap((id) => bar.filter((tab) => tab.sessionId === id))
        const others = bar.filter((tab) => !sessionIds.includes(tab.sessionId))
        tabs = [...tabs.filter((tab) => tab.projectPath !== projectPath), ...named, ...others]
        return projectTabs(projectPath)
      }),
    "session.create": ({ projectPath }: { projectPath: string }) =>
      Effect.sync(() => {
        const at = tick()
        const session: Session = {
          id: `session-${nextId++}`,
          projectPath,
          workingFolder: projectPath,
          inWorktree: false,
          branch: "main",
          started: false,
          workingFolderDeleted: false,
          harness,
          model: runOptions.model.default,
          effort: runOptions.effort.default,
          permissionMode: runOptions.permissionMode.default,
          relaunchFailure: null,
          pendingMessages: [],
          unreadMessages: [],
          title: "New session",
          status: "idle",
          statusChangedAt: at,
          createdAt: at,
          lastActivityAt: at,
          archivedAt: null,
          lastImageNumber: 0,
          waitingFor: null,
        }
        sessions.set(session.id, session)
        return session
      }),
    "session.setRunOptions": ({
      sessionId,
      options: requested,
    }: {
      sessionId: string
      options: Partial<RunOptions>
    }) =>
      Effect.suspend(() => {
        const session = sessions.get(sessionId)
        if (!session) return Effect.fail(new SessionNotFound({ sessionId }))
        for (const option of ["model", "effort", "permissionMode"] as const) {
          const to = requested[option]
          if (to === undefined || to === session[option] || !session.started) continue
          const items = itemsOf(sessionId)
          publish({
            id: `run-option-${nextId++}`,
            sessionId,
            position: (items.at(-1)?.position ?? -1) + 1,
            at: 0,
            type: "run_option",
            option,
            from: session[option],
            to,
            fromName: fakeNameOf(option, session[option]),
            toName: fakeNameOf(option, to),
          })
        }
        return Effect.succeed(saveSession({ ...session, ...requested, relaunchFailure: null }))
      }),
    "session.watch": ({ projectPath }: { projectPath: string }) =>
      Stream.unwrap(
        Effect.map(PubSub.subscribe(sessionChanges), (subscription) =>
          Stream.fromIterable(
            [...sessions.values()]
              .filter((session) => session.archivedAt === null)
              .map((session): SessionChange => ({ _tag: "changed", session })),
          ).pipe(
            Stream.concat(Stream.fromSubscription(subscription)),
            Stream.filter(
              (change) =>
                (change._tag === "changed" ? change.session.projectPath : change.projectPath) ===
                projectPath,
            ),
          ),
        ),
      ),
    "session.listArchived": ({ projectPath }: { projectPath: string }) =>
      Effect.sync(() =>
        [...sessions.values()]
          .filter((session) => session.projectPath === projectPath && session.archivedAt !== null)
          .toSorted(
            (a, b) => DateTime.toEpochMillis(b.archivedAt!) - DateTime.toEpochMillis(a.archivedAt!),
          ),
      ),
    "session.archive": ({ sessionId }: { sessionId: string }) =>
      Effect.map(existing(sessionId), (session) => {
        removeTab(session)
        saveSession({ ...session, status: "idle", archivedAt: tick() })
      }),
    "session.restore": ({ sessionId }: { sessionId: string }) =>
      Effect.map(existing(sessionId), (session) => saveSession({ ...session, archivedAt: null })),
    "session.delete": ({ sessionId }: { sessionId: string }) =>
      Effect.map(existing(sessionId), (session) => {
        removeTab(session)
        sessions.delete(sessionId)
        transcripts.delete(sessionId)
        annotationsOf({ _tag: "session", sessionId }).forEach(removeAnnotation)
        Effect.runSync(
          PubSub.publish(sessionChanges, {
            _tag: "removed",
            sessionId,
            projectPath: session.projectPath,
          }),
        )
      }),
    "session.interrupt": ({ sessionId }: { sessionId: string }) =>
      Effect.sync(() => {
        const items = itemsOf(sessionId)
        publish({
          id: `interruption-${nextId++}`,
          sessionId,
          position: items.length,
          at: 0,
          type: "interruption",
        })
        const session = sessions.get(sessionId)!
        return saveSession({
          ...session,
          status: "idle",
          pendingMessages: [],
          unreadMessages: [...session.unreadMessages, ...session.pendingMessages],
          lastActivityAt: tick(),
        })
      }),
    "session.sendNow": ({ sessionId }: { sessionId: string }) =>
      Effect.sync(() => {
        const session = sessions.get(sessionId)!
        if (session.pendingMessages.length === 0) return session
        publish({
          id: `interruption-${nextId++}`,
          sessionId,
          position: itemsOf(sessionId).length,
          at: 0,
          type: "interruption",
        })
        readMessages(session, false)
        return saveSession({
          ...sessions.get(sessionId)!,
          status: "working",
          lastActivityAt: tick(),
        })
      }),
    "session.list": ({ projectPath }: { projectPath: string }) =>
      Effect.sync(() => [...sessions.values()].filter((s) => s.projectPath === projectPath)),
    "session.rename": ({ sessionId, title }: { sessionId: string; title: string }) =>
      Effect.sync(() => {
        const renamed = { ...sessions.get(sessionId)!, title }
        sessions.set(sessionId, renamed)
        return renamed
      }),
    "session.sendMessage": (input: {
      sessionId: string
      messageId: string
      text: string
      images?: ReadonlyArray<ImageData>
      workingFolder?: WorkingFolderChoice
    }) =>
      Effect.flatMap(
        Effect.promise(async () => {
          sentMessages.push(input)
          if (hold) {
            const ok = await hold.wait
            hold = null
            if (!ok) throw new Error("send failed")
          }
          return sessions.get(input.sessionId)
        }),
        (session): Effect.Effect<Session, SessionNotFound | WorktreeNotCreated> =>
          session === undefined
            ? Effect.fail(new SessionNotFound({ sessionId: input.sessionId }))
            : worktreeFailure !== null
              ? Effect.sync(() =>
                  publish({
                    id: `error-${nextId++}`,
                    sessionId: input.sessionId,
                    position: itemsOf(input.sessionId).length,
                    at: 0,
                    type: "error",
                    message: worktreeFailure!,
                  }),
                ).pipe(
                  Effect.andThen(
                    Effect.fail(
                      new WorktreeNotCreated({ sessionId: input.sessionId, reason: "git" }),
                    ),
                  ),
                )
              : Effect.succeed(session),
      ).pipe(
        Effect.map((session) => {
          const items = itemsOf(input.sessionId)
          const isFirstMessage = !session.started
          const sent = input.images ?? []
          const unsent = {
            id: input.messageId,
            text: input.text,
            images: sent.map(({ id, number, mediaType }) => ({ id, number, mediaType })),
          }
          if (session.status === "working" || session.status === "waiting") {
            return saveSession({
              ...session,
              pendingMessages: [...session.pendingMessages, unsent],
              unreadMessages: [],
            })
          }
          publish({
            id: input.messageId,
            sessionId: input.sessionId,
            position: items.length,
            at: 0,
            type: "message",
            role: "user",
            text: input.text,
            images: sent.map(({ id, number, mediaType }) => ({ id, number, mediaType })),
            steer: false,
          })
          const choice = isFirstMessage ? input.workingFolder : undefined
          const worktree =
            choice?.kind === "new_worktree"
              ? {
                  path: `${session.projectPath}/.worktrees/ivin-generated`,
                  branch: "ivin/generated",
                }
              : choice?.kind === "existing_worktree"
                ? worktrees.find((w) => w.path === choice.path)
                : undefined
          const updated: Session = {
            ...session,
            ...(worktree && {
              workingFolder: worktree.path,
              inWorktree: true,
              branch: worktree.branch,
            }),
            started: true,
            workingFolderDeleted: false,
            relaunchFailure: null,
            unreadMessages: [],
            status: "working",
            title: isFirstMessage ? input.text : session.title,
            lastActivityAt: tick(),
            archivedAt: null,
            lastImageNumber: Math.max(session.lastImageNumber, ...sent.map((i) => i.number)),
            waitingFor: null,
          }
          return saveSession(updated)
        }),
      ),
    "session.pickWorkingFolder": (input: {
      sessionId: string
      workingFolder: WorkingFolderChoice
    }) =>
      Effect.suspend(() => {
        const session = sessions.get(input.sessionId)
        if (session === undefined) {
          return Effect.fail(new SessionNotFound({ sessionId: input.sessionId }))
        }
        pickedFolders.push(input.workingFolder)
        const choice = input.workingFolder
        const folder =
          choice.kind === "checkout"
            ? { path: session.projectPath, inWorktree: false, branch: "main" }
            : choice.kind === "new_worktree"
              ? {
                  path: `${session.projectPath}/.worktrees/ivin-generated`,
                  inWorktree: true,
                  branch: "ivin/generated",
                }
              : {
                  path: choice.path,
                  inWorktree: true,
                  branch: worktrees.find((w) => w.path === choice.path)?.branch ?? null,
                }
        return Effect.succeed(
          saveSession({
            ...session,
            workingFolder: folder.path,
            inWorktree: folder.inWorktree,
            branch: folder.branch,
            workingFolderDeleted: false,
          }),
        )
      }),
    "file.listFolder": ({ sessionId, path }: { sessionId: string; path: string }) =>
      Effect.suspend(
        (): Effect.Effect<
          ReadonlyArray<FolderEntry>,
          SessionNotFound | WorkingFolderDeleted | FolderNotListed
        > => {
          const session = sessions.get(sessionId)
          if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
          if (!folders.has(session.workingFolder))
            return Effect.fail(new WorkingFolderDeleted({ sessionId }))
          const folder = path === "" ? session.workingFolder : `${session.workingFolder}/${path}`
          listedFolders.push(folder)
          const entries = folders.get(folder)
          return entries === undefined
            ? Effect.fail(new FolderNotListed({ sessionId, path, reason: "missing" }))
            : Effect.succeed(entries)
        },
      ),
    "file.listFiles": ({ sessionId }: { sessionId: string }) =>
      Effect.suspend((): Effect.Effect<FileList, SessionNotFound | WorkingFolderDeleted> => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        if (!folders.has(session.workingFolder))
          return Effect.fail(new WorkingFolderDeleted({ sessionId }))
        fileListings++
        return Effect.succeed({ paths: filesUnder(session.workingFolder, ""), truncated: false })
      }),
    "file.gitStatus": ({ sessionId }: { sessionId: string }) =>
      Effect.suspend(() => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        return Effect.succeed(gitStatus.get(session.workingFolder) ?? [])
      }),
    "file.listChanges": ({ sessionId }: { sessionId: string }) =>
      Effect.suspend((): Effect.Effect<ChangeList, SessionNotFound | GitFailed> => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        const listed = changes.get(session.workingFolder) ?? { kind: "listed", changes: [] }
        return "gitMessage" in listed
          ? Effect.fail(new GitFailed({ sessionId, gitMessage: listed.gitMessage }))
          : Effect.succeed(listed)
      }),
    "file.readDiff": ({ sessionId, path }: { sessionId: string; path: string }) =>
      Effect.suspend((): Effect.Effect<FileDiff, SessionNotFound> => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        return Effect.succeed(
          diffs.get(`${session.workingFolder}/${path}`) ?? { kind: "unchanged" },
        )
      }),
    "file.listCommittedChanges": ({ sessionId }: { sessionId: string }) =>
      Effect.suspend((): Effect.Effect<CommittedChangeList, SessionNotFound | GitFailed> => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        const listed = committedChanges.get(session.workingFolder) ?? {
          kind: "listed",
          base: "origin/main",
          changes: [],
        }
        return "gitMessage" in listed
          ? Effect.fail(new GitFailed({ sessionId, gitMessage: listed.gitMessage }))
          : Effect.succeed(listed)
      }),
    "file.readCommittedDiff": ({ sessionId, path }: { sessionId: string; path: string }) =>
      Effect.suspend((): Effect.Effect<FileDiff, SessionNotFound> => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        return Effect.succeed(
          committedDiffs.get(`${session.workingFolder}/${path}`) ?? { kind: "unchanged" },
        )
      }),
    "file.discardChanges": ({
      sessionId,
      paths,
    }: {
      sessionId: string
      paths: ReadonlyArray<string>
    }) =>
      Effect.suspend((): Effect.Effect<void, SessionNotFound | GitFailed> => {
        const session = sessions.get(sessionId)
        if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
        const { workingFolder } = session
        const gitMessage = paths
          .map((path) => discardFailures.get(`${workingFolder}/${path}`))
          .find((message) => message !== undefined)
        if (gitMessage !== undefined) return Effect.fail(new GitFailed({ sessionId, gitMessage }))
        const listed = changes.get(workingFolder)
        if (listed !== undefined && "changes" in listed)
          changes.set(workingFolder, {
            kind: "listed",
            changes: listed.changes.filter((change) => !paths.includes(change.path)),
          })
        return PubSub.publish(diskChanges, { workingFolder, change: { paths } }).pipe(Effect.asVoid)
      }),
    "file.watch": ({ sessionId }: { sessionId: string }) =>
      Stream.unwrap(
        Effect.suspend(() => {
          const session = sessions.get(sessionId)
          if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
          return Effect.map(PubSub.subscribe(diskChanges), (subscription) =>
            Stream.fromSubscription(subscription).pipe(
              Stream.filter(({ workingFolder }) => workingFolder === session.workingFolder),
              Stream.map(({ change }) => change),
            ),
          )
        }),
      ),
    "file.readFile": ({ sessionId, path }: { sessionId: string; path: string }) =>
      Effect.promise(() => holdRead ?? Promise.resolve()).pipe(
        Effect.andThen(
          (): Effect.Effect<FileContent, SessionNotFound | WorkingFolderDeleted | FileNotRead> => {
            holdRead = null
            const session = sessions.get(sessionId)
            if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
            const file = files.get(`${session.workingFolder}/${path}`)
            if (file === undefined)
              return Effect.fail(new FileNotRead({ sessionId, path, reason: "missing" }))
            if (file === "unreadable")
              return Effect.fail(new FileNotRead({ sessionId, path, reason: "unreadable" }))
            return Effect.succeed(file.kind === "text" ? { ...file, version: file.text } : file)
          },
        ),
      ),
    "file.writeFile": ({
      sessionId,
      path,
      text,
      expectedVersion,
    }: {
      sessionId: string
      path: string
      text: string
      expectedVersion: string | null
    }) =>
      Effect.suspend(
        (): Effect.Effect<
          { version: string },
          SessionNotFound | FileChangedOnDisk | FileNotWritten
        > => {
          const session = sessions.get(sessionId)
          if (session === undefined) return Effect.fail(new SessionNotFound({ sessionId }))
          const at = `${session.workingFolder}/${path}`
          const file = files.get(at)
          const onDisk = file !== undefined && file !== "unreadable" && file.kind === "text"
          if (expectedVersion !== null && (!onDisk || file.text !== expectedVersion))
            return Effect.fail(new FileChangedOnDisk({ sessionId, path }))
          if (fake.unwritable)
            return Effect.fail(new FileNotWritten({ sessionId, path, reason: "unwritable" }))
          files.set(at, { kind: "text", text })
          return Effect.succeed({ version: text })
        },
      ),
    "tab.listSubViews": ({ sessionId }: { sessionId: string }) =>
      withSession(sessionId, () => subViewsOf(sessionId)),
    "tab.openSubView": ({ sessionId, subView }: { sessionId: string; subView: SubView }) =>
      withSession(sessionId, () => {
        const next = withSubViewOpen(subViewsOf(sessionId), subView)
        subViews.set(sessionId, next)
        return next
      }),
    "tab.closeSubView": ({ sessionId, subView }: { sessionId: string; subView: SubView }) =>
      withSession(sessionId, () => {
        const next = withSubViewClosed(subViewsOf(sessionId), subView)
        subViews.set(sessionId, next)
        return next
      }),
    "tab.setFullWidth": ({ sessionId, fullWidth }: { sessionId: string; fullWidth: boolean }) =>
      withSession(sessionId, () => {
        const next = withFullWidth(subViewsOf(sessionId), fullWidth)
        subViews.set(sessionId, next)
        return next
      }),
    "tab.selectSessionTab": ({ sessionId }: { sessionId: string }) =>
      withSession(sessionId, () => {
        const next = withSessionTabSelected(subViewsOf(sessionId))
        subViews.set(sessionId, next)
        return next
      }),
    "worktree.list": () => Effect.sync(() => [...worktrees]),
    "worktree.newBase": () => Effect.succeed("origin/main"),
    "worktree.checkoutStatus": () => Effect.sync(checkoutStatus),
    "session.switchToDefaultBranch": ({
      sessionId,
      localChanges,
    }: {
      sessionId: string
      localChanges?: LocalChangesChoice
    }): Effect.Effect<Session, CheckoutHasLocalChanges> =>
      checkout.dirty && !localChanges
        ? Effect.fail(new CheckoutHasLocalChanges({ sessionId }))
        : Effect.sync(() => {
            if (localChanges) localChangesChoices.push(localChanges)
            Object.assign(checkout, { branch: checkout.defaultBranch, behind: 0, dirty: false })
            return saveSession({ ...sessions.get(sessionId)!, branch: checkout.branch })
          }),
    "session.fastForward": ({
      sessionId,
      stash,
    }: {
      sessionId: string
      stash?: boolean
    }): Effect.Effect<Session, GitRefused> =>
      checkout.dirty && checkout.pullRefusal !== null && stash !== true
        ? Effect.fail(
            new GitRefused({
              sessionId,
              message: checkout.pullRefusal,
              blockedByLocalChanges: true,
            }),
          )
        : Effect.sync(() => {
            if (stash === true) localChangesChoices.push("stash before pull")
            Object.assign(checkout, { behind: 0, dirty: stash === true ? false : checkout.dirty })
            return sessions.get(sessionId)!
          }),
    "worktree.listBranches": () =>
      Stream.make({ branches: branches.filter((b) => !b.remote), fetch: "fetching" as const }).pipe(
        Stream.concat(
          Stream.fromEffect(
            Effect.promise(async () => {
              const fetched = holdFetch === null ? true : await holdFetch
              holdFetch = null
              return fetched
                ? { branches: [...branches], fetch: "done" as const }
                : { branches: branches.filter((b) => !b.remote), fetch: "failed" as const }
            }),
          ),
        ),
      ),
    "session.pickBranch": (input: { sessionId: string; name: string; remote: boolean }) =>
      Effect.suspend((): Effect.Effect<Session, CheckoutRefused> => {
        if (checkoutFailure !== null) {
          return Effect.fail(
            new CheckoutRefused({ sessionId: input.sessionId, gitMessage: checkoutFailure }),
          )
        }
        const session = sessions.get(input.sessionId)!
        const name = input.remote ? input.name.slice("origin/".length) : input.name
        const holder = branches.find((b) => !b.remote && b.name === name)?.worktreePath ?? null
        const workingFolder = holder ?? session.workingFolder
        return Effect.succeed(
          saveSession({
            ...session,
            workingFolder,
            inWorktree: workingFolder !== session.projectPath,
            branch: name,
          }),
        )
      }),
    "session.answerApproval": (input: { sessionId: string; requestId: string; allow: boolean }) =>
      Effect.sync(() => {
        const items = itemsOf(input.sessionId)
        const index = items.findIndex(
          (i) => i.type === "approval" && i.requestId === input.requestId,
        )
        const item = items[index]
        if (item?.type === "approval") {
          const answered = {
            ...item,
            decision: input.allow ? ("allow" as const) : ("deny" as const),
          }
          items[index] = answered
          Effect.runSync(PubSub.publish(pubsub, { type: "upsert", item: answered }))
        }
        const updated = { ...sessions.get(input.sessionId)!, status: "working" as const }
        sessions.set(input.sessionId, updated)
        return updated
      }),
    "session.answerQuestion": (input: {
      sessionId: string
      requestId: string
      answers: ReadonlyArray<QuestionAnswer> | null
    }) =>
      Effect.sync(() => {
        const items = itemsOf(input.sessionId)
        const index = items.findIndex(
          (i) => i.type === "question" && i.requestId === input.requestId,
        )
        const item = items[index]
        if (item?.type === "question") {
          const answered =
            input.answers === null
              ? { ...item, status: "declined" as const }
              : { ...item, status: "answered" as const, answers: input.answers }
          items[index] = answered
          Effect.runSync(PubSub.publish(pubsub, { type: "upsert", item: answered }))
        }
        const updated = { ...sessions.get(input.sessionId)!, status: "working" as const }
        sessions.set(input.sessionId, updated)
        return updated
      }),
    "transcript.getItems": getItems,
    "transcript.listImages": ({ sessionId }: { sessionId: string }) =>
      Effect.sync(() =>
        itemsOf(sessionId).flatMap((item) =>
          item.type === "message" && item.role === "user"
            ? item.images.map((image) => ({ ...image, messageId: item.id, messageText: item.text }))
            : [],
        ),
      ),
    "annotation.add": ({
      target,
      ns,
      kind,
      data,
    }: {
      target: AnnotationTarget
      ns: string
      kind: string
      data: Annotation["data"]
    }) =>
      Effect.sync(() => {
        const at = tick()
        const key = keyOf(kind, data)
        const same = annotationsOf(target).find(
          (a) => key !== undefined && a.ns === ns && a.kind === kind && keyOf(kind, a.data) === key,
        )
        const annotation: Annotation = same
          ? { ...same, data, updatedAt: at }
          : { id: `annotation-${nextId++}`, target, ns, kind, data, createdAt: at, updatedAt: at }
        annotations.set(annotation.id, annotation)
        Effect.runSync(PubSub.publish(annotationChanges, { _tag: "changed", annotation }))
        return annotation
      }),
    "annotation.remove": ({ id }: { id: string }) =>
      Effect.suspend(() => {
        const annotation = annotations.get(id)
        if (!annotation) return Effect.fail(new AnnotationNotFound({ id }))
        removeAnnotation(annotation)
        return Effect.void
      }),
    "annotation.list": ({ target, kind }: { target: AnnotationTarget; kind: string | null }) =>
      Effect.sync(() => annotationsOf(target).filter((a) => kind === null || a.kind === kind)),
    "annotation.watch": ({ target }: { target: AnnotationTarget }) =>
      Stream.unwrap(
        Effect.map(PubSub.subscribe(annotationChanges), (subscription) =>
          Stream.fromIterable(
            annotationsOf(target).map((annotation): AnnotationChange => ({
              _tag: "changed",
              annotation,
            })),
          ).pipe(
            Stream.concat(
              Stream.fromSubscription(subscription).pipe(
                Stream.filter((change) =>
                  sameTarget(
                    change._tag === "changed" ? change.annotation.target : change.target,
                    target,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    "transcript.watchItems": ({ sessionId, before }: { sessionId: string; before: number }) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const subscription = yield* PubSub.subscribe(pubsub)
          const page = yield* getItems({ sessionId, position: null, before, after: 0 })
          return Stream.make({ type: "page" as const, page }).pipe(
            Stream.concat(
              Stream.fromSubscription(subscription).pipe(
                Stream.filter(
                  (change) =>
                    (change.type === "upsert"
                      ? change.item.sessionId
                      : change.type === "delta"
                        ? change.sessionId
                        : sessionId) === sessionId,
                ),
              ),
            ),
          )
        }),
      ),
  }

  const failingClient = Object.fromEntries(
    Object.entries(client).map(([rpc, call]) => [
      rpc,
      (...args: Array<unknown>) => {
        const run = () =>
          failing.delete(rpc)
            ? Effect.die(new Error(`${rpc} failed`))
            : (call as (...a: Array<unknown>) => unknown)(...args)
        const held = holding.get(rpc)
        if (!held) return run()
        holding.delete(rpc)
        return Effect.promise(() => held).pipe(
          Effect.flatMap((ok) => {
            if (!ok) failing.add(rpc)
            return run() as Effect.Effect<unknown, unknown>
          }),
        )
      },
    ]),
  )

  const fake: FakeServer = {
    layer: Layer.succeed(ServerClient)(failingClient as unknown as ServerClient["Service"]),
    sessions,
    errorReports,
    userPlugins,
    pluginFailures,
    sentMessages,
    pickedFolders,
    worktrees,
    checkout,
    localChangesChoices,
    failWorktreeWith: (gitMessage) => void (worktreeFailure = gitMessage),
    branches,
    holdNextFetch: () => {
      let settle!: (ok: boolean) => void
      holdFetch = new Promise<boolean>((resolve) => (settle = resolve))
      return { release: () => settle(true), fail: () => settle(false) }
    },
    failCheckoutWith: (gitMessage) => void (checkoutFailure = gitMessage),
    pushItem: publish,
    pushChange: (change) => Effect.runSync(PubSub.publish(pubsub, change)),
    setStatus: (sessionId, status) => void saveSession({ ...sessions.get(sessionId)!, status }),
    failRelaunch: (sessionId, failure) =>
      void saveSession({ ...sessions.get(sessionId)!, relaunchFailure: failure }),
    seedItems: (sessionId, items) => itemsOf(sessionId).push(...items),
    readPendingMessages: (sessionId) => readMessages(sessions.get(sessionId)!, true),
    holdNextSend: () => {
      let settle!: (ok: boolean) => void
      hold = { wait: new Promise<boolean>((resolve) => (settle = resolve)) }
      return { release: () => settle(true), fail: () => settle(false) }
    },
    holdNextReorder: () => {
      let settle!: (ok: boolean) => void
      holdReorder = { wait: new Promise<boolean>((resolve) => (settle = resolve)) }
      return { release: () => settle(true), fail: () => settle(false) }
    },
    openProject: (path) => void Effect.runSync(client["project.open"]({ path })),
    openTab: (sessionId) => void Effect.runSync(client["tab.open"]({ sessionId })),
    holdNextTabList: () => {
      let release!: () => void
      holdTabList = new Promise<void>((resolve) => (release = resolve))
      return { release }
    },
    tabOrder: (projectPath) => tabsOf(projectPath).map((tab) => tab.sessionId),
    setUserSettings: (state) => {
      userSettings = state
      Effect.runSync(PubSub.publish(settingChanges, state))
    },
    setUserKeybindings: (state) => {
      userKeybindings = state
      Effect.runSync(PubSub.publish(keybindingChanges, state))
    },
    failNextCall: (rpc) => void failing.add(rpc),
    holdNextCall: (rpc) => {
      let settle!: (ok: boolean) => void
      holding.set(rpc, new Promise<boolean>((resolve) => (settle = resolve)))
      return { release: () => settle(true), fail: () => settle(false) }
    },
    shell,
    folders,
    listedFolders,
    gitStatus,
    changes,
    diffs,
    committedChanges,
    committedDiffs,
    discardFailures,
    fileListings: () => fileListings,
    changeOnDisk: (workingFolder, paths) =>
      Effect.runSync(PubSub.publish(diskChanges, { workingFolder, change: { paths } })),
    files,
    unwritable: false,
    holdNextRead: () => {
      let release!: () => void
      holdRead = new Promise<void>((resolve) => (release = resolve))
      return { release }
    },
    subViews,
  }
  return fake
}
