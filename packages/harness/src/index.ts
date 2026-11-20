export {
  HarnessError,
  HarnessProvider,
  type ApprovalDecision,
  type HarnessRun,
  type StartInput,
  type ToolActivity,
  type ToolOutcome,
  type ToolUse,
  type UserMessage,
} from "./shared/harness-provider.ts"
export {
  demoAnswer,
  demoApprovalScript,
  demoScript,
  demoUsage,
} from "./modules/scripted/adapters/demo-script.ts"
export {
  layerScripted,
  scriptedFailure,
  type ScriptedElement,
  type ScriptedFailure,
  type ScriptedOptions,
  type ScriptedSend,
} from "./modules/scripted/adapters/scripted-provider.ts"
export { layerClaude } from "./modules/claude/adapters/claude-provider.ts"
