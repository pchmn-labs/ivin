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

const kindOf = (line: string, inHeader: boolean): DiffLine["kind"] => {
  if (
    inHeader &&
    /^(diff |index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(line)
  ) {
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
        .map((text, i, lines) => ({
          kind: kindOf(text, !lines.slice(0, i).some((earlier) => earlier.startsWith("@@"))),
          text,
        }))
