import { createHash } from "node:crypto"

export type Bump = "minor" | "patch" | "none"

const TYPE = /^(\w+)(\([^)]*\))?!?:/

export const bumpLevel = (subjects: readonly string[]): Bump => {
  const types = new Set(subjects.map((subject) => TYPE.exec(subject)?.[1]))
  if (types.has("feat")) return "minor"
  return types.has("fix") ? "patch" : "none"
}

export type Channel = "stable" | "beta"

// `tags` newest first.
export const baseTag = (tags: readonly string[], channel: Channel): string | undefined =>
  channel === "beta" ? tags[0] : tags.find((tag) => !tag.includes("-"))

export const withVersion = (packageJson: string, version: string): string =>
  packageJson.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`)

export const manifest = (version: string, file: string, zip: Uint8Array): string =>
  `${JSON.stringify({ version, file, size: zip.length, sha512: createHash("sha512").update(zip).digest("hex") }, null, 2)}\n`

const isBetaHeading = (heading: string) => /^## \[?\d+\.\d+\.\d+-/.test(heading)

export const releaseNotes = (changelog: string): string => {
  const [, ...parts] = changelog.split(/^(## .*)\n/m)
  const sections = []
  for (let index = 0; index < parts.length; index += 2) {
    sections.push({ heading: parts[index] ?? "", body: (parts[index + 1] ?? "").trim() })
  }
  const [top, ...rest] = sections
  if (top === undefined) return "\n"
  const previousStable = rest.findIndex((section) => !isBetaHeading(section.heading))
  const betas = isBetaHeading(top.heading)
    ? []
    : rest.slice(0, previousStable === -1 ? rest.length : previousStable)
  return `${[top.body, ...betas.map(({ heading, body }) => `${heading}\n\n${body}`)].join("\n\n").trim()}\n`
}
