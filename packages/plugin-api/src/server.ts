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
  }
  // In the plugin's own namespace.
  readonly annotations: {
    readonly add: <K extends string>(
      target: AnnotationTarget,
      annotation: { readonly kind: K; readonly data: AnnotationDataOf<K> },
    ) => Promise<Annotation>
    readonly remove: (id: string) => Promise<void>
    readonly list: (target: AnnotationTarget, kind?: string) => Promise<ReadonlyArray<Annotation>>
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
  // One run of `fn` per key across plugins, paused while the window is hidden; `fn` may return `{ every }` to change its interval.
  readonly poll: (
    key: string,
    fn: () => void | { readonly every: number } | Promise<void | { readonly every: number }>,
    options: PollOptions,
  ) => void
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

export type { Annotation, AnnotationTarget, Json, Session } from "./types.ts"
