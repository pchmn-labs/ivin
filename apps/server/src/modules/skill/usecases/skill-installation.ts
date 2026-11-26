import type { SkillInstall } from "@ivin/contracts/server"
import { Context } from "effect"

// What installing ivin's skills at startup did, one entry per skill; empty for a harness with no skills folder.
export const SkillInstallation = Context.Reference<ReadonlyArray<SkillInstall>>(
  "ivin/server/SkillInstallation",
  { defaultValue: () => [] },
)
