import type { HarnessOutput } from "@ivin/contracts/transcript"
import { Context, Data, type Effect, type Scope, type Stream } from "effect"

export class HarnessError extends Data.TaggedError("HarnessError")<{
  readonly message: string
  readonly cause?: unknown
}> {}

export interface StartInput {
  readonly sessionId: string
  readonly cwd: string
  readonly model: string
}

export interface UserMessage {
  readonly text: string
}

export interface ApprovalDecision {
  readonly requestId: string
  readonly allow: boolean
}

export interface HarnessRun {
  readonly events: Stream.Stream<HarnessOutput, HarnessError>
  readonly send: (message: UserMessage) => Effect.Effect<void, HarnessError>
  readonly respond: (decision: ApprovalDecision) => Effect.Effect<void, HarnessError>
  readonly interrupt: Effect.Effect<void>
}

export class HarnessProvider extends Context.Service<
  HarnessProvider,
  {
    readonly id: "claude" | "codex" | "acp" | "scripted"
    readonly start: (input: StartInput) => Effect.Effect<HarnessRun, HarnessError, Scope.Scope>
  }
>()("ivin/harness/HarnessProvider") {}
