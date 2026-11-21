import type { ToolKind } from "@ivin/contracts/transcript"

const KINDS: Readonly<Record<string, ToolKind>> = {
  Bash: "command",
  Read: "read",
  Edit: "edit",
  MultiEdit: "edit",
  Write: "edit",
  NotebookEdit: "edit",
  Grep: "search",
  Glob: "search",
  Skill: "skill",
  // Claude Code named its subagent tool Task before it became Agent.
  Task: "agent",
  Agent: "agent",
}

export const toolKind = (name: string): ToolKind => KINDS[name] ?? "other"
