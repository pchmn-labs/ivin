import type { SkillInstall } from "@ivin/contracts/server"
import { Context } from "effect"

// What installing ivin's skill at startup did; null until main installs it.
export const SkillInstallation = Context.Reference<SkillInstall | null>(
  "ivin/server/SkillInstallation",
  { defaultValue: () => null },
)
