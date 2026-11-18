import { DateTime, Effect, Layer, PubSub, Stream } from "effect"
import type { UserKeybindings } from "@ivin/contracts/keybinding"
import type { ErrorReport } from "@ivin/contracts/log"
import type { OpenProjects, Project } from "@ivin/contracts/project"
import type { Session, SessionStatus } from "@ivin/contracts/session"
import type { ProjectTabs } from "@ivin/contracts/tab"
import type { TranscriptItem, TranscriptItemChange } from "@ivin/contracts/transcript"
import { ProjectNotOpen } from "@ivin/contracts/project"
import { SessionNotFound } from "@ivin/contracts/session"
import { ServerClient } from "./server-client.ts"

export interface FakeServer {
  readonly layer: Layer.Layer<ServerClient>
  readonly sessions: Map<string, Session>
  readonly errorReports: Array<ErrorReport>
  // Adds an item to a transcript as the server would, and streams it to watchers.
  readonly pushItem: (item: TranscriptItem) => void
  // Streams any change (a delta, say) to watchers without storing it.
  readonly pushChange: (change: TranscriptItemChange) => void
  // Changes a session's status as the server would, and streams it to `session.watch`.
  readonly setStatus: (sessionId: string, status: SessionStatus) => void
  readonly seedItems: (sessionId: string, items: ReadonlyArray<TranscriptItem>) => void
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
}

export const makeFakeServer = (options: { readonly project?: Project } = {}): FakeServer => {
  let projects: Array<Project> = options.project ? [options.project] : []
  let selectedPath: string | null = options.project?.path ?? null
  let tabs: Array<{ sessionId: string; projectPath: string }> = []
  const selectedTab = new Map<string, string | null>()
  const sessions = new Map<string, Session>()
  const transcripts = new Map<string, Array<TranscriptItem>>()
  const pubsub = Effect.runSync(PubSub.unbounded<TranscriptItemChange>())
  const sessionChanges = Effect.runSync(PubSub.unbounded<Session>())
  let userKeybindings: UserKeybindings = { keybindings: [], problem: null }
  const keybindingChanges = Effect.runSync(PubSub.unbounded<UserKeybindings>())
  let clock = 1_000
  let nextId = 1
  let hold: { readonly wait: Promise<boolean> } | null = null
  let holdReorder: { readonly wait: Promise<boolean> } | null = null
  let holdTabList: Promise<void> | null = null
  const errorReports: Array<ErrorReport> = []
  const failing = new Set<string>()

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

  const saveSession = (session: Session) => {
    sessions.set(session.id, session)
    Effect.runSync(PubSub.publish(sessionChanges, session))
    return session
  }

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
    "log.writeError": (report: ErrorReport) => Effect.sync(() => void errorReports.push(report)),
    "keybinding.watch": () =>
      Stream.unwrap(
        Effect.map(PubSub.subscribe(keybindingChanges), (subscription) =>
          Stream.make(userKeybindings).pipe(Stream.concat(Stream.fromSubscription(subscription))),
        ),
      ),
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
        const bar = tabsOf(session.projectPath)
        const index = bar.findIndex((tab) => tab.sessionId === sessionId)
        tabs = tabs.filter((tab) => tab.sessionId !== sessionId)
        if (index >= 0 && selectedTab.get(session.projectPath) === sessionId) {
          const rest = tabsOf(session.projectPath)
          selectedTab.set(session.projectPath, (rest[index] ?? rest[index - 1])?.sessionId ?? null)
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
    "session.create": ({ projectPath, model }: { projectPath: string; model: string }) =>
      Effect.sync(() => {
        const at = tick()
        const session: Session = {
          id: `session-${nextId++}`,
          projectPath,
          model,
          title: "New session",
          status: "idle",
          createdAt: at,
          lastActivityAt: at,
        }
        sessions.set(session.id, session)
        return session
      }),
    "session.watch": ({ projectPath }: { projectPath: string }) =>
      Stream.unwrap(
        Effect.map(PubSub.subscribe(sessionChanges), (subscription) =>
          Stream.fromIterable([...sessions.values()]).pipe(
            Stream.concat(Stream.fromSubscription(subscription)),
            Stream.filter((session) => session.projectPath === projectPath),
          ),
        ),
      ),
    "session.interrupt": ({ sessionId }: { sessionId: string }) =>
      Effect.sync(() => {
        const items = itemsOf(sessionId)
        publish({
          id: `interruption-${nextId++}`,
          sessionId,
          position: items.length,
          type: "interruption",
        })
        return saveSession({ ...sessions.get(sessionId)!, status: "idle", lastActivityAt: tick() })
      }),
    "session.list": ({ projectPath }: { projectPath: string }) =>
      Effect.sync(() => [...sessions.values()].filter((s) => s.projectPath === projectPath)),
    "session.rename": ({ sessionId, title }: { sessionId: string; title: string }) =>
      Effect.sync(() => {
        const renamed = { ...sessions.get(sessionId)!, title }
        sessions.set(sessionId, renamed)
        return renamed
      }),
    "session.sendMessage": (input: { sessionId: string; messageId: string; text: string }) =>
      Effect.flatMap(
        Effect.promise(async () => {
          if (hold) {
            const ok = await hold.wait
            hold = null
            if (!ok) throw new Error("send failed")
          }
          return sessions.get(input.sessionId)
        }),
        (session) =>
          session === undefined
            ? Effect.fail(new SessionNotFound({ sessionId: input.sessionId }))
            : Effect.succeed(session),
      ).pipe(
        Effect.map((session) => {
          const items = itemsOf(input.sessionId)
          const isFirstMessage = items.length === 0
          publish({
            id: input.messageId,
            sessionId: input.sessionId,
            position: items.length,
            type: "message",
            role: "user",
            text: input.text,
          })
          const updated: Session = {
            ...session,
            status: "working",
            title: isFirstMessage ? input.text : session.title,
            lastActivityAt: tick(),
          }
          return saveSession(updated)
        }),
      ),
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
    "transcript.getItems": getItems,
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
      (...args: Array<unknown>) =>
        failing.delete(rpc)
          ? Effect.die(new Error(`${rpc} failed`))
          : (call as (...a: Array<unknown>) => unknown)(...args),
    ]),
  )

  return {
    layer: Layer.succeed(ServerClient)(failingClient as unknown as ServerClient["Service"]),
    sessions,
    errorReports,
    pushItem: publish,
    pushChange: (change) => Effect.runSync(PubSub.publish(pubsub, change)),
    setStatus: (sessionId, status) => void saveSession({ ...sessions.get(sessionId)!, status }),
    seedItems: (sessionId, items) => itemsOf(sessionId).push(...items),
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
    setUserKeybindings: (state) => {
      userKeybindings = state
      Effect.runSync(PubSub.publish(keybindingChanges, state))
    },
    failNextCall: (rpc) => void failing.add(rpc),
  }
}
