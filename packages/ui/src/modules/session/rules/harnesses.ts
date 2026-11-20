import type { Harness } from "@ivin/contracts/session"
import type { MarkName } from "../../../core/components/harness-mark/harness-mark.tsx"

export interface HarnessDisplay {
  readonly name: string
  readonly mark: MarkName
  readonly models: ReadonlyArray<string>
  readonly defaultModel: string
}

export const HARNESSES: Record<Harness, HarnessDisplay> = {
  claude: {
    name: "Claude",
    mark: "claude",
    models: ["opus", "sonnet", "haiku"],
    defaultModel: "sonnet",
  },
  codex: {
    name: "Codex",
    mark: "agent",
    models: ["gpt-5-codex", "gpt-5"],
    defaultModel: "gpt-5-codex",
  },
  acp: { name: "the agent", mark: "agent", models: ["default"], defaultModel: "default" },
  scripted: {
    name: "the scripted agent",
    mark: "agent",
    models: ["scripted"],
    defaultModel: "scripted",
  },
}

export const newSessionModel = (harness: Harness, picked: string | null) => {
  const { models, defaultModel } = HARNESSES[harness]
  return picked !== null && models.includes(picked) ? picked : defaultModel
}
