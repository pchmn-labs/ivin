import { Context, type Effect } from "effect"

export interface PluginProjectsService {
  // The folders of the trusted projects.
  readonly trusted: Effect.Effect<ReadonlyArray<string>>
  // The open projects' own paths, by the trusted folder each one resolves to.
  readonly openAs: Effect.Effect<ReadonlyMap<string, ReadonlyArray<string>>>
}

// Null when the server has no projects: no project plugin loads.
export const PluginProjects = Context.Reference<PluginProjectsService | null>(
  "ivin/server/PluginProjects",
  { defaultValue: () => null },
)
