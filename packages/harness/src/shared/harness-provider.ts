import type { Harness } from "@ivin/contracts/session"
import type { HarnessOutput, ImageData } from "@ivin/contracts/transcript"
import { Context, Data, type Effect, type Scope, type Stream } from "effect"

export class HarnessError extends Data.TaggedError("HarnessError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface StartInput {
  readonly sessionId: string
  readonly cwd: string
  readonly model: string
  readonly providerSessionId: string | null
}

export interface UserMessage {
  readonly text: string
  readonly images: readonly ImageData[]
}

export interface ApprovalDecision {
  readonly requestId: string
  readonly allow: boolean
}

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
  readonly respond: (decision: ApprovalDecision) => Effect.Effect<void, HarnessError>
  readonly interrupt: Effect.Effect<void>
}

export class HarnessProvider extends Context.Service<
  HarnessProvider,
  {
    readonly id: Harness
    readonly start: (input: StartInput) => Effect.Effect<HarnessRun, HarnessError, Scope.Scope>
    readonly toolActivity: (call: ToolUse, result: ToolOutcome) => ToolActivity
  }
>()("ivin/harness/HarnessProvider") {}
