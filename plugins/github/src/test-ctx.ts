import type {
  Annotation,
  AnnotationTarget,
  ExecOptions,
  ExecResult,
  Json,
  ServerContext,
  Session,
  SpawnPatch,
  TranscriptEvent,
} from "@ivin/plugin-api/server"
import { activate } from "./server.ts"

export interface ExecCall {
  readonly program: string
  readonly args: ReadonlyArray<string>
  readonly options: ExecOptions | undefined
}

type Reply = Partial<ExecResult> | Error

interface Poll {
  readonly fn: () => void | { readonly every: number } | Promise<void | { readonly every: number }>
  every: number
  stopped: boolean
}

const ok = (stdout: string): ExecResult => ({ stdout, stderr: "", exitCode: 0 })

export const makeSession = (id: string, fields: Partial<Session> = {}): Session =>
  ({
    id,
    projectPath: "/shop",
    workingFolder: "/shop",
    inWorktree: false,
    branch: null,
    title: id,
    ...fields,
  }) as Session

const sessionIdOf = (target: AnnotationTarget) =>
  target._tag === "session" ? target.sessionId : ""

export interface Start {
  readonly sessions?: ReadonlyArray<Session>
  readonly storage?: Readonly<Record<string, Json>>
  readonly annotations?: ReadonlyArray<{ ns: string; sessionId: string; kind: string; data: Json }>
  readonly replies?: ReadonlyArray<[string, Reply | string]>
}

export const startPlugin = async (start: Start = {}) => {
  const sessions = new Map<string, Session>(start.sessions?.map((s) => [s.id, s]))
  const created: Array<(session: Session) => void> = []
  const changed: Array<(session: Session) => void> = []
  const transcript: Array<(session: Session, event: TranscriptEvent) => void> = []
  const spawns: Array<
    (spawn: { sessionId: string }) => SpawnPatch | Promise<SpawnPatch | void> | void
  > = []
  const commands = new Map<string, (args: Json) => Json | Promise<Json | void> | void>()
  const polls = new Map<string, Poll>()
  const storage = new Map<string, Json>(Object.entries(start.storage ?? {}))
  const annotations: Annotation[] = []
  const calls: ExecCall[] = []
  const replies: Array<{ prefix: string; reply: Reply }> = []
  let nextId = 1

  const ctx: ServerContext = {
    signal: new AbortController().signal,
    fetch: () => Promise.reject(new Error("The github plugin reads GitHub through gh, not fetch.")),
    transcript: { onEvent: (handler) => void transcript.push(handler) },
    sessions: {
      onCreated: (handler) => void created.push(handler),
      onChanged: (handler) => void changed.push(handler),
      list: async () => [...sessions.values()],
      get: async (id) => sessions.get(id),
    },
    annotations: {
      add: async (target, annotation) => {
        const data = JSON.parse(JSON.stringify(annotation.data)) as Json
        const url = (data as { url?: unknown }).url
        const same = annotations.findIndex(
          (a) =>
            a.ns === "github" &&
            a.kind === annotation.kind &&
            sessionIdOf(a.target) === sessionIdOf(target) &&
            (a.data as { url?: unknown }).url === url,
        )
        if (same >= 0) {
          const updated = { ...annotations[same]!, data }
          annotations[same] = updated
          return updated
        }
        const added = {
          id: `a${nextId++}`,
          target,
          ns: "github",
          kind: annotation.kind,
          data,
        } as unknown as Annotation
        annotations.push(added)
        return added
      },
      remove: async (id) => {
        const index = annotations.findIndex((a) => a.id === id)
        if (index >= 0) annotations.splice(index, 1)
      },
      list: async (target, kind) =>
        annotations.filter(
          (a) =>
            a.ns === "github" &&
            sessionIdOf(a.target) === sessionIdOf(target) &&
            (kind === undefined || a.kind === kind),
        ),
      listAll: async (target, kind) =>
        annotations.filter(
          (a) =>
            sessionIdOf(a.target) === sessionIdOf(target) &&
            (kind === undefined || a.kind === kind),
        ),
    },
    storage: {
      get: async (key) => storage.get(key),
      set: async (key, value) => void storage.set(key, JSON.parse(JSON.stringify(value)) as Json),
    },
    commands: {
      register: (id, handler) => void commands.set(id, handler),
      run: async () => null,
    },
    settings: { get: async () => undefined, onChange: () => {} },
    exec: async (program, args, options) => {
      calls.push({ program, args, options })
      const line = [program, ...args].join(" ")
      const hit = [...replies].reverse().find((r) => line.startsWith(r.prefix))
      if (hit === undefined) return { stdout: "", stderr: `unscripted: ${line}`, exitCode: 1 }
      if (hit.reply instanceof Error) throw hit.reply
      return { stdout: "", stderr: "", exitCode: 0, ...hit.reply }
    },
    poll: (key, fn, options) => {
      const poll: Poll = { fn, every: options.every, stopped: false }
      polls.set(key, poll)
      return () => {
        poll.stopped = true
      }
    },
    setInterval: () => {},
    harness: { beforeSpawn: (handler) => void spawns.push(handler) },
  }

  for (const [prefix, reply] of start.replies ?? []) {
    replies.push({ prefix, reply: typeof reply === "string" ? ok(reply) : reply })
  }
  for (const seeded of start.annotations ?? []) {
    annotations.push({
      id: `a${nextId++}`,
      target: { _tag: "session", sessionId: seeded.sessionId },
      ns: seeded.ns,
      kind: seeded.kind,
      data: seeded.data,
    } as Annotation)
  }

  await activate(ctx)

  const getPoll = (key: string) => {
    const poll = polls.get(key)
    if (poll === undefined) throw new Error(`no poll ${key}`)
    return poll
  }

  return {
    calls,
    storage,
    annotations,
    addSession: (id: string, fields: Partial<Session> = {}) => {
      const session = makeSession(id, fields)
      sessions.set(id, session)
      return session
    },
    updateSession: (id: string, fields: Partial<Session>) => {
      const session = { ...sessions.get(id)!, ...fields }
      sessions.set(id, session)
      for (const handler of changed) handler(session)
      return session
    },
    sessionCreated: (session: Session) => {
      for (const handler of created) handler(session)
    },
    // Every `gh`/`git` call whose command line starts with `prefix` gets `reply`; the latest rule wins.
    reply: (prefix: string, reply: Reply | string) =>
      void replies.push({ prefix, reply: typeof reply === "string" ? ok(reply) : reply }),
    seed: (ns: string, sessionId: string, kind: string, data: Json) =>
      void annotations.push({
        id: `a${nextId++}`,
        target: { _tag: "session", sessionId },
        ns,
        kind,
        data,
      } as Annotation),
    emit: (session: Session, event: Record<string, Json>) => {
      const full = { id: "e", sessionId: session.id, sequence: 0, at: 0, ...event }
      for (const handler of transcript) handler(session, full as unknown as TranscriptEvent)
    },
    pollKeys: () => [...polls.entries()].filter(([, p]) => !p.stopped).map(([key]) => key),
    pollStopped: (key: string) => polls.get(key)?.stopped ?? true,
    pollEvery: (key: string) => getPoll(key).every,
    // One run of a poll's function, as the scheduler would; the interval it asks for replaces the current one.
    tick: async (key: string) => {
      const poll = getPoll(key)
      const next = await poll.fn()
      if (next !== undefined && next !== null) poll.every = next.every
    },
    runCommand: async (id: string, args: Json = null) => commands.get(id)!(args),
    beforeSpawn: async (sessionId: string) => {
      const patches = await Promise.all(
        spawns.map((handler) => Promise.resolve(handler({ sessionId }))),
      )
      return patches.find((patch): patch is SpawnPatch => patch !== undefined)
    },
    prAnnotations: (sessionId: string, ns = "github") =>
      annotations
        .filter((a) => a.ns === ns && a.kind === "pr" && sessionIdOf(a.target) === sessionId)
        .map((a) => a.data as Record<string, Json>),
  }
}
