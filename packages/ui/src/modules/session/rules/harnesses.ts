import type { Harness } from "@ivin/contracts/session"
import type { MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"

export interface HarnessDisplay {
  readonly name: string
  readonly mark: MarkName
  readonly maxImageBytes: number
}

const FIVE_MB = 5 * 1024 * 1024

export const HARNESSES: Record<Harness, HarnessDisplay> = {
  claude: { name: "Claude", mark: "claude", maxImageBytes: FIVE_MB },
  codex: { name: "Codex", mark: "agent", maxImageBytes: FIVE_MB },
  acp: { name: "the agent", mark: "agent", maxImageBytes: FIVE_MB },
  scripted: { name: "the scripted agent", mark: "agent", maxImageBytes: FIVE_MB },
}
