export {
  HarnessError,
  HarnessProvider,
  type ApprovalDecision,
  type HarnessRun,
  type StartInput,
  type UserMessage,
} from "./shared/harness-provider.ts"
export { demoAnswer, demoScript } from "./modules/scripted/adapters/demo-script.ts"
export { layerScripted, type ScriptedSend } from "./modules/scripted/adapters/scripted-provider.ts"
