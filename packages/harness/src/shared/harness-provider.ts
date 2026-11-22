import type { HarnessProgram } from "@ivin/contracts/server"
import type { Harness, HarnessRunOptions, RunOptions } from "@ivin/contracts/session"
import type { HarnessOutput, ImageData, QuestionAnswer, ToolKind } from "@ivin/contracts/transcript"
import { Context, Data, type Effect, type Scope, type Stream } from "effect"

export class HarnessError extends Data.TaggedError("HarnessError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface StartInput {
  readonly sessionId: string
  readonly cwd: string
  readonly options: RunOptions
  readonly providerSessionId: string | null
}

export interface UserMessage {
  readonly id: string
  readonly text: string
  readonly images: readonly ImageData[]
}

export interface ApprovalDecision {
  readonly requestId: string
  readonly allow: boolean
}

export interface QuestionAnswers {
  readonly requestId: string
  readonly answers: readonly QuestionAnswer[] | null
}

export type RequestAnswer = ApprovalDecision | QuestionAnswers

export interface ToolUse {
  readonly name: string
  readonly input: unknown
}

export interface ToolOutcome {
  readonly output: string
}

// What a successful tool call did to where the agent works.
// `folder_switch`: the agent itself now works in `path`; `shell`: a command, which may create a worktree.
export type ToolActivity =
  | { readonly type: "folder_switch"; readonly path: string }
  | { readonly type: "shell"; readonly command: string }
  | { readonly type: "other"; readonly text: string }

export interface HarnessRun {
  readonly events: Stream.Stream<HarnessOutput, HarnessError>
  readonly send: (message: UserMessage) => Effect.Effect<void, HarnessError>
  readonly respond: (answer: RequestAnswer) => Effect.Effect<void, HarnessError>
  readonly interrupt: Effect.Effect<void>
}

export class HarnessProvider extends Context.Service<
  HarnessProvider,
  {
    readonly id: Harness
    readonly runOptions: Effect.Effect<HarnessRunOptions>
    readonly program: Effect.Effect<HarnessProgram | null>
    // The folder the harness reads the user's skills from; null for a harness that takes none.
    readonly skillsFolder: string | null
    readonly start: (input: StartInput) => Effect.Effect<HarnessRun, HarnessError, Scope.Scope>
    readonly toolActivity: (call: ToolUse, result: ToolOutcome) => ToolActivity
    readonly toolKind: (name: string) => ToolKind
  }
>()("ivin/harness/HarnessProvider") {}
