import { createHash } from "node:crypto"

export type Bump = "minor" | "patch" | "none"

const TYPE = /^(\w+)(\([^)]*\))?!?:/

// Breaking changes stay minor: the monorepo is 0.x until the switch.
export const bumpLevel = (subjects: readonly string[]): Bump => {
  const types = new Set(subjects.map((subject) => TYPE.exec(subject)?.[1]))
  if (types.has("feat")) return "minor"
  return types.has("fix") ? "patch" : "none"
}

export const withVersion = (packageJson: string, version: string): string =>
  packageJson.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`)

export const manifest = (version: string, file: string, zip: Uint8Array): string =>
  `${JSON.stringify({ version, file, size: zip.length, sha512: createHash("sha512").update(zip).digest("hex") }, null, 2)}\n`

export const latestSection = (changelog: string): string => {
  const [, top = ""] = changelog.split(/^## .*\n/m)
  return `${top.trim()}\n`
}
