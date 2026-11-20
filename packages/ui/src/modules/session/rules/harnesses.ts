import type { Harness } from "@ivin/contracts/session"
import type { MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"

export interface HarnessDisplay {
  readonly name: string
  readonly mark: MarkName
}

export const HARNESSES: Record<Harness, HarnessDisplay> = {
  claude: { name: "Claude", mark: "claude" },
  codex: { name: "Codex", mark: "agent" },
  acp: { name: "the agent", mark: "agent" },
  scripted: { name: "the scripted agent", mark: "agent" },
}
