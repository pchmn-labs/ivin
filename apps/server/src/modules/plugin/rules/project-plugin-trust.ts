import type { ProjectPluginState } from "@ivin/contracts/plugin"
import type { Permissions } from "./permissions.ts"

export interface TrustedVersion {
  readonly hash: string
  readonly permissions: ReadonlyArray<string>
}

export interface TrustDecision {
  readonly state: ProjectPluginState
  readonly permissionsChanged: boolean
  // The files on disk become the trusted version without a question: the project has full trust.
  readonly adopt: boolean
}

// The permissions as one sorted list of `kind: entry`, to compare two manifests.
export const permissionList = (permissions: Permissions): ReadonlyArray<string> =>
  (["harness", "exec", "fetch"] as const)
    .flatMap((kind) => permissions[kind].map((entry) => `${kind}: ${entry}`))
    .toSorted()

export const decideTrust = ({
  trusted,
  hash,
  permissions,
  fullTrust,
}: {
  readonly trusted: TrustedVersion | null
  readonly hash: string
  readonly permissions: ReadonlyArray<string>
  readonly fullTrust: boolean
}): TrustDecision => {
  if (trusted?.hash === hash) return { state: "trusted", permissionsChanged: false, adopt: false }
  const known = trusted?.permissions ?? []
  const permissionsChanged =
    permissions.length !== known.length || permissions.some((entry, i) => entry !== known[i])
  if (fullTrust && !permissionsChanged) {
    return { state: "trusted", permissionsChanged, adopt: true }
  }
  return { state: trusted === null ? "new" : "changed", permissionsChanged, adopt: false }
}

export const projectPluginsRoot = (project: string) =>
  `${project.endsWith("/") ? project.slice(0, -1) : project}/.ivin/plugins`

// The name the reload machinery knows a project plugin's folder by.
export const projectPluginKey = (project: string, folderName: string) =>
  `${projectPluginsRoot(project)}/${folderName}`

export const projectNameOf = (project: string) =>
  project.split("/").filter(Boolean).at(-1) ?? project
