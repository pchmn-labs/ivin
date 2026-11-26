import type {
  ExecResult,
  Json,
  ServerContext,
  Session,
  SpawnPatch,
  TranscriptEvent,
} from "@ivin/plugin-api/server"
import { execFile, type ChildProcess } from "node:child_process"

export type CallServer = (method: string, args: Json) => Promise<Json>

type CommandHandler = (args: Json) => Json | Promise<Json | void> | void
type PollFunction = () =>
  | void
  | { readonly every: number }
  | Promise<void | { readonly every: number }>

const orNull = (value: Json | void | undefined): Json => (value === undefined ? null : value)

// `callServer` carries the plugin's calls to the server, which answers them.
export const makePluginContext = (callServer: CallServer = () => Promise.resolve(null)) => {
  const controller = new AbortController()
  const disposers: Array<() => void> = []
  // Registrations the server must know before `activate` is done: `ivin run` may come right after.
  const registering: Promise<unknown>[] = []
  const transcriptHandlers: Array<(session: Session, event: TranscriptEvent) => void> = []
  const sessionHandlers: Array<(session: Session) => void> = []
  const settingHandlers: Array<(key: string, value: Json) => void> = []
  const commands = new Map<string, CommandHandler>()
  const polls = new Map<string, PollFunction>()
  const spawnHandlers: Array<
    (spawn: { readonly sessionId: string }) => SpawnPatch | Promise<SpawnPatch | void> | void
  > = []
  const children = new Set<ChildProcess>()

  const register = (disposer: () => void) => {
    disposers.push(disposer)
  }
  const announce = (method: string, args: Json = null) => {
    const call = callServer(method, args)
    registering.push(call.catch(() => undefined))
    return call
  }
  const optional = async (method: string, args: Json) => {
    const answer = (await callServer(method, args)) as { value?: Json } | null
    return answer !== null && "value" in answer ? answer.value : undefined
  }
  const subscribeOnce = (handlers: unknown[], method: string) => {
    if (handlers.length === 0) void announce(method)
  }
  const permit = async (call: Json) => {
    const missing = await callServer("permission.check", { call })
    if (missing !== null) throw new Error(`Its manifest does not declare ${missing as string}.`)
  }

  const ctx: ServerContext = {
    signal: controller.signal,
    transcript: {
      onEvent: (handler) => {
        subscribeOnce(transcriptHandlers, "transcript.subscribe")
        transcriptHandlers.push(handler)
      },
    },
    sessions: {
      onCreated: (handler) => {
        subscribeOnce(sessionHandlers, "sessions.subscribe")
        sessionHandlers.push(handler)
      },
    },
    annotations: {
      add: (target, { kind, data }) =>
        callServer("annotations.add", { target, kind, data: data as Json }) as Promise<never>,
      remove: async (id) => void (await callServer("annotations.remove", { id })),
      list: (target, kind) =>
        callServer(
          "annotations.list",
          kind === undefined ? { target } : { target, kind },
        ) as Promise<never>,
    },
    storage: {
      get: (key) => optional("storage.get", { key }),
      set: async (key, value) => void (await callServer("storage.set", { key, value })),
    },
    commands: {
      register: (id, handler) => {
        commands.set(id, handler)
        void announce("commands.register", { command: id })
      },
      run: (id, args = null) => callServer("commands.run", { command: id, args }),
    },
    settings: {
      get: (key) => optional("settings.get", { key }),
      onChange: (handler) => {
        subscribeOnce(settingHandlers, "settings.subscribe")
        settingHandlers.push(handler)
      },
    },
    exec: async (program, args, options = {}) => {
      await permit({ member: "exec", binary: program })
      return new Promise<ExecResult>((resolve, reject) => {
        const child = execFile(
          program,
          [...args],
          {
            ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
            maxBuffer: 64 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            children.delete(child)
            // A string code is the system refusing to start it; a signal or an exit code is its result.
            if (error !== null && typeof error.code === "string") {
              reject(new Error(error.message))
              return
            }
            resolve({ stdout, stderr, exitCode: child.exitCode })
          },
        )
        children.add(child)
      })
    },
    poll: (key, fn, { every }) => {
      polls.set(key, fn)
      void announce("poll.register", { key, every })
    },
    setInterval: (fn, ms) => {
      const timer = setInterval(fn, ms)
      register(() => clearInterval(timer))
    },
    harness: {
      beforeSpawn: (handler) => {
        if (spawnHandlers.length === 0) {
          const subscribing = permit({ member: "harness.beforeSpawn" }).then(() =>
            callServer("beforeSpawn.subscribe", null),
          )
          registering.push(subscribing)
        }
        spawnHandlers.push(handler)
      },
    },
  }

  register(() => {
    for (const child of children) child.kill("SIGKILL")
    children.clear()
  })

  return {
    ctx,
    register,
    // Done when the server knows everything `activate` registered.
    registered: async () => void (await Promise.all(registering.splice(0))),
    // What the server tells the plugin: the handlers' results, or what a handler threw.
    dispatch: async (kind: string, payload: Json): Promise<Json> => {
      const data = (payload ?? {}) as { [key: string]: Json }
      switch (kind) {
        case "transcript":
          for (const handler of transcriptHandlers) {
            handler(
              data["session"] as unknown as Session,
              data["event"] as unknown as TranscriptEvent,
            )
          }
          return null
        case "sessionCreated":
          for (const handler of sessionHandlers) handler(data["session"] as unknown as Session)
          return null
        case "settingChanged":
          for (const handler of settingHandlers)
            handler(data["key"] as string, data["value"] as Json)
          return null
        case "command": {
          const handler = commands.get(data["command"] as string)
          if (handler === undefined)
            throw new Error(`No command named ${data["command"] as string}.`)
          return orNull(await handler(data["args"] ?? null))
        }
        case "beforeSpawn": {
          let env: Record<string, string> = {}
          for (const handler of spawnHandlers) {
            const patch = await handler({ sessionId: data["sessionId"] as string })
            env = { ...env, ...patch?.env }
          }
          return { env }
        }
        case "poll": {
          const result = await polls.get(data["key"] as string)?.()
          return result === undefined ? null : { every: result.every }
        }
        default:
          throw new Error(`Unknown dispatch ${kind}`)
      }
    },
    // The caller logs what the disposers threw against the plugin.
    dispose: (): unknown[] => {
      controller.abort()
      const failures: unknown[] = []
      for (const disposer of disposers.splice(0).reverse()) {
        try {
          disposer()
        } catch (error) {
          failures.push(error)
        }
      }
      return failures
    },
  }
}
