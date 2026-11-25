import type { ActionFailure } from "@ivin/plugin-api/ui"

export const agentCommandsFailure = (harnessName: string): ActionFailure => ({
  text: `Could not load ${harnessName}'s skills and commands. The message still sends as typed.`,
  retryable: true,
})
