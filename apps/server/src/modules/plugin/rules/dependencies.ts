export type Dependencies = Readonly<Record<string, string>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const dependenciesOf = (packageJson: string): Dependencies => {
  let json: unknown
  try {
    json = JSON.parse(packageJson)
  } catch {
    return {}
  }
  const dependencies = isRecord(json) ? json["dependencies"] : undefined
  if (!isRecord(dependencies)) return {}
  return Object.fromEntries(
    Object.entries(dependencies).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  )
}

// Only the dependencies: the rest of the plugin's package.json (its peer @ivin/plugin-api) is not on npm.
export const installManifest = (dependencies: Dependencies) =>
  `${JSON.stringify({ dependencies })}\n`

// Locked and installed outside the plugin's folder, where a relative path leads elsewhere.
export const relativeLocalDependency = (dependencies: Dependencies): string | null =>
  Object.entries(dependencies).find(([, spec]) => /^(file|link):(?!\/)/.test(spec))?.[0] ?? null

// pnpm's `ERR_PNPM_<CODE>  <message>` line, or its last line when it printed none.
export const pnpmError = (output: string) => {
  const lines = output.split("\n").map((line) => line.trim())
  const error = lines.find((line) => /ERR_PNPM_[A-Z_]+/.test(line))
  return {
    code: error?.match(/ERR_PNPM_[A-Z_]+/)?.[0] ?? null,
    message: (error ?? lines.filter((line) => line !== "").at(-1) ?? "pnpm failed").replace(
      /^.*?ERR_PNPM_[A-Z_]+\s*/,
      "",
    ),
  }
}
