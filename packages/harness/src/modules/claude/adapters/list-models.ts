import { homedir } from "node:os"
import { type Duration, Effect } from "effect"
import { modelsFromInitialize } from "../rules/initialize.ts"
import { askInitialize } from "./ask-initialize.ts"

// Empty when Claude Code is missing, fails or does not answer in time.
export const listClaudeModels = (timeout: Duration.Input) =>
  // The home folder, as the models are the account's, whatever the project.
  askInitialize(homedir(), modelsFromInitialize, timeout).pipe(Effect.orElseSucceed(() => []))
