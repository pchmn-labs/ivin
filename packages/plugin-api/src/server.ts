import type {
  Annotation,
  AnnotationDataOf,
  AnnotationTarget,
  Json,
  Session,
  UtcDateTime,
} from "./types.ts"

// A normalised event of a session's transcript; its other fields depend on `type`.
export interface TranscriptEvent {
  readonly type: string
  readonly id: string
  readonly sessionId: string
  readonly sequence: number
  readonly at: UtcDateTime
  readonly [field: string]: Json | UtcDateTime
}

export interface SpawnPatch {
  // Added to the agent's environment; a later plugin wins on the same name.
  readonly env?: { readonly [name: string]: string }
}

export interface ExecOptions {
  readonly cwd?: string
  // Added to the server's environment for this run only.
  readonly env?: { readonly [name: string]: string }
  // Milliseconds before the program is killed and the call rejects; 30 s when absent.
  readonly timeout?: number
}

export interface ExecResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
}

export interface PollOptions {
  readonly every: number
}

export interface ServerContext {
  // Aborted when the plugin is deactivated.
  readonly signal: AbortSignal
  readonly transcript: {
    readonly onEvent: (handler: (session: Session, event: TranscriptEvent) => void) => void
  }
  readonly sessions: {
    readonly onCreated: (handler: (session: Session) => void) => void
    // After a session's stored state changes: its branch, its title, its status…
    readonly onChanged: (handler: (session: Session) => void) => void
    // The sessions of every project, archived ones left out.
    readonly list: () => Promise<ReadonlyArray<Session>>
    readonly get: (sessionId: string) => Promise<Session | undefined>
  }
  // In the plugin's own namespace.
  readonly annotations: {
    readonly add: <K extends string>(
      target: AnnotationTarget,
      annotation: { readonly kind: K; readonly data: AnnotationDataOf<K> },
    ) => Promise<Annotation>
    readonly remove: (id: string) => Promise<void>
    readonly list: (target: AnnotationTarget, kind?: string) => Promise<ReadonlyArray<Annotation>>
    // Every plugin's and the CLI's annotations on the target, to read only.
    readonly listAll: (
      target: AnnotationTarget,
      kind?: string,
    ) => Promise<ReadonlyArray<Annotation>>
  }
  // Kept per plugin across restarts.
  readonly storage: {
    readonly get: (key: string) => Promise<Json | undefined>
    readonly set: (key: string, value: Json) => Promise<void>
  }
  readonly commands: {
    readonly register: (
      id: string,
      handler: (args: Json) => Json | Promise<Json | void> | void,
    ) => void
    // Another plugin's command, with its result.
    readonly run: (id: string, args?: Json) => Promise<Json>
  }
  // The settings the plugin's manifest declares.
  readonly settings: {
    readonly get: (key: string) => Promise<Json | undefined>
    readonly onChange: (handler: (key: string, value: Json) => void) => void
  }
  readonly exec: (
    program: string,
    args: ReadonlyArray<string>,
    options?: ExecOptions,
  ) => Promise<ExecResult>
  // Made by the server, to a host the manifest's `permissions.fetch` declares, also after each redirect.
  readonly fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  // One run of `fn` per key across plugins, paused while the window is hidden, and run at once when the window shows again after 15 s; `fn` may return `{ every }` to change its interval. The returned function stops it.
  readonly poll: (
    key: string,
    fn: () => void | { readonly every: number } | Promise<void | { readonly every: number }>,
    options: PollOptions,
  ) => () => void
  readonly setInterval: (fn: () => void, ms: number) => void
  readonly harness: {
    readonly beforeSpawn: (
      handler: (spawn: {
        readonly sessionId: string
      }) => SpawnPatch | Promise<SpawnPatch | void> | void,
    ) => void
  }
}

export type ServerPlugin = (ctx: ServerContext) => void | Promise<void>

export const defineServer = (activate: ServerPlugin): ServerPlugin => activate

export type { Annotation, AnnotationTarget, Json, PrAnnotationData, Session } from "./types.ts"
