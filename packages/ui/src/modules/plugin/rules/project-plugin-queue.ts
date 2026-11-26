import type { ProjectPlugin, ProjectPluginChange, ProjectPlugins } from "@ivin/contracts/plugin"

export const waitingPlugins = (
  projects: ReadonlyArray<ProjectPlugins>,
  projectPath: string,
): ReadonlyArray<ProjectPlugin> =>
  projects
    .find((state) => state.project === projectPath || state.openAs.includes(projectPath))
    ?.plugins.filter((plugin) => plugin.state !== "trusted") ?? []

export const unseenChanges = (state: ProjectPlugins): ReadonlyArray<ProjectPluginChange> =>
  state.changes.filter((change) => !change.seen)

export interface DiffLine {
  readonly kind: "file" | "hunk" | "added" | "removed" | "context"
  readonly text: string
}

const kindOf = (line: string): DiffLine["kind"] => {
  if (/^(diff |index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(line)) {
    return "file"
  }
  if (line.startsWith("@@")) return "hunk"
  if (line.startsWith("+")) return "added"
  if (line.startsWith("-")) return "removed"
  return "context"
}

export const diffLines = (diff: string): ReadonlyArray<DiffLine> =>
  diff === ""
    ? []
    : diff
        .replace(/\n$/, "")
        .split("\n")
        .map((text) => ({ kind: kindOf(text), text }))
