export {
  HarnessError,
  HarnessProvider,
  type ApprovalDecision,
  type QuestionAnswers,
  type RequestAnswer,
  type HarnessRun,
  type StartInput,
  type ToolActivity,
  type ToolOutcome,
  type ToolUse,
  type UserMessage,
} from "./shared/harness-provider.ts"
export {
  demoAgentCommands,
  demoAnswer,
  demoApprovalScript,
  demoQuestionScript,
  demoShotScript,
  demoScript,
  demoUsage,
} from "./modules/scripted/adapters/demo-script.ts"
export {
  layerScripted,
  scriptedFailure,
  scriptedLater,
  scriptedRead,
  scriptedRunOptions,
  type ScriptedElement,
  type ScriptedFailure,
  type ScriptedOptions,
  type ScriptedRead,
  type ScriptedSend,
} from "./modules/scripted/adapters/scripted-provider.ts"
export { layerClaude } from "./modules/claude/adapters/claude-provider.ts"
