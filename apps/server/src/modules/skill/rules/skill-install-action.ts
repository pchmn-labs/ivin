export interface InstalledSkill {
  readonly exists: boolean
  // The version ivin wrote in the folder's marker file; null when the folder has none.
  readonly marker: string | null
}

export type SkillInstallAction = "install" | "update" | "keep" | "leave"

export const skillInstallAction = (
  installed: InstalledSkill,
  version: string,
): SkillInstallAction => {
  if (!installed.exists) return "install"
  if (installed.marker === null) return "leave"
  return installed.marker === version ? "keep" : "update"
}
