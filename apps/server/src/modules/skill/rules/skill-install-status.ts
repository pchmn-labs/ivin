import type { SkillInstall } from "@ivin/contracts/server"

export interface InstalledSkill {
  readonly exists: boolean
  readonly markerVersion: string | null
}

export const skillInstallStatus = (
  installed: InstalledSkill,
  version: string,
): Exclude<SkillInstall["status"], "failed"> => {
  if (!installed.exists) return "installed"
  if (installed.markerVersion === null) return "notOurs"
  return installed.markerVersion === version ? "upToDate" : "updated"
}
