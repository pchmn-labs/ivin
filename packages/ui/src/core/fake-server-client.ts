import { DateTime, Effect, Layer, PubSub, Stream } from "effect"
import type { Project } from "@ivin/contracts/project"
import type { Session, SessionStatus } from "@ivin/contracts/session"
import type { TranscriptItem, TranscriptItemChange } from "@ivin/contracts/transcript"
import { ServerClient } from "./server-client.ts"

export interface FakeServer {
  readonly layer: Layer.Layer<ServerClient>
  readonly sessions: Map<string, Session>
  // Adds an item to a transcript as the server would, and streams it to watchers.
  readonly pushItem: (item: TranscriptItem) => void
  // Streams any change (a delta, say) to watchers without storing it.
  readonly pushChange: (change: TranscriptItemChange) => void
  // Changes a session's status as the server would, and streams it to `session.watch`.
  readonly setStatus: (sessionId: string, status: SessionStatus) => void
  readonly seedItems: (sessionId: string, items: ReadonlyArray<TranscriptItem>) => void
  // Makes the next sendMessage wait until `release` is called, or fail.
  readonly holdNextSend: () => { readonly release: () => void; readonly fail: () => void }
}

export const makeFakeServer = (options: { readonly project?: Project } = {}): FakeServer => {
  let project: Project | null = options.project ?? null
  const sessions = new Map<string, Session>()
  const transcripts = new Map<string, Array<TranscriptItem>>()
  const pubsub = Effect.runSync(PubSub.unbounded<TranscriptItemChange>())
  const sessionChanges = Effect.runSync(PubSub.unbounded<Session>())
  let clock = 1_000
  let nextId = 1
  let hold: { readonly wait: Promise<boolean> } | null = null

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
    "project.getCurrent": () => Effect.sync(() => project),
    "project.open": ({ path }: { path: string }) =>
      Effect.sync(() => {
        project = { path, name: path.split("/").at(-1)!, lastOpenedAt: tick() }
        return project
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
      Effect.promise(async () => {
        if (hold) {
          const ok = await hold.wait
          hold = null
          if (!ok) throw new Error("send failed")
        }
        const session = sessions.get(input.sessionId)!
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

  return {
    layer: Layer.succeed(ServerClient)(client as unknown as ServerClient["Service"]),
    sessions,
    pushItem: publish,
    pushChange: (change) => Effect.runSync(PubSub.publish(pubsub, change)),
    setStatus: (sessionId, status) => void saveSession({ ...sessions.get(sessionId)!, status }),
    seedItems: (sessionId, items) => itemsOf(sessionId).push(...items),
    holdNextSend: () => {
      let settle!: (ok: boolean) => void
      hold = { wait: new Promise<boolean>((resolve) => (settle = resolve)) }
      return { release: () => settle(true), fail: () => settle(false) }
    },
  }
}
