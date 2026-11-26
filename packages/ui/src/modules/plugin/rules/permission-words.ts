import type { PluginPermissions } from "@ivin/contracts/plugin"

export interface PermissionWords {
  // What the plugin's code can do whatever it declares.
  readonly reach: string
  // A `"*"` first: it says the most.
  readonly declared: ReadonlyArray<string>
}

const unique = (lines: ReadonlyArray<string>) => [...new Set(lines)]

const hostWords = (host: string) =>
  host.startsWith("*.") ? `Connects to any host under ${host.slice(2)}` : `Connects to ${host}`

export const permissionWords = (
  permissions: PluginPermissions,
  hasServer: boolean,
): PermissionWords => {
  const anyProgram = permissions.exec.includes("*")
  const anyHost = permissions.fetch.includes("*")
  return {
    reach: hasServer
      ? "Runs code on your machine with your rights"
      : "Cannot run commands or read files",
    declared: unique([
      ...(anyProgram ? ["Runs any program"] : []),
      ...(anyHost ? ["Connects to any host"] : []),
      ...permissions.harness.map(() => "Changes the environment of the agents ivin starts"),
      ...(anyProgram ? [] : permissions.exec.map((program) => `Runs ${program}`)),
      ...(anyHost ? [] : permissions.fetch.map(hostWords)),
    ]),
  }
}
