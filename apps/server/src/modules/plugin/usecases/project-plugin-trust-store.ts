import type { ProjectPluginChange } from "@ivin/contracts/plugin"
import { Context, type Effect } from "effect"
import type { TrustedVersion } from "../rules/project-plugin-trust.ts"

export interface ProjectPluginTrustStoreService {
  readonly trusted: (project: string, id: string) => Effect.Effect<TrustedVersion | null>
  readonly trust: (project: string, id: string, version: TrustedVersion) => Effect.Effect<void>
  readonly fullTrust: (project: string) => Effect.Effect<boolean>
  readonly setFullTrust: (project: string, enabled: boolean) => Effect.Effect<void>
  // Oldest first.
  readonly changes: (project: string) => Effect.Effect<ReadonlyArray<ProjectPluginChange>>
  readonly addChange: (project: string, change: ProjectPluginChange) => Effect.Effect<void>
  readonly markChangesSeen: (project: string) => Effect.Effect<void>
}

// Null when the server keeps no trust: no project plugin loads.
export const ProjectPluginTrustStore = Context.Reference<ProjectPluginTrustStoreService | null>(
  "ivin/server/ProjectPluginTrustStore",
  { defaultValue: () => null },
)
