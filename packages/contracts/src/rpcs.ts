import { AnnotationRpcs } from "./annotation.ts"
import { FileRpcs } from "./file.ts"
import { KeybindingRpcs } from "./keybinding.ts"
import { LogRpcs } from "./log.ts"
import { ProjectRpcs } from "./project.ts"
import { ServerRpcs } from "./server.ts"
import { SessionRpcs } from "./session.ts"
import { SettingRpcs } from "./setting.ts"
import { TabRpcs } from "./tab.ts"
import { TranscriptRpcs } from "./transcript.ts"
import { WorktreeRpcs } from "./worktree.ts"

export const Rpcs = ServerRpcs.merge(
  AnnotationRpcs,
  FileRpcs,
  KeybindingRpcs,
  LogRpcs,
  ProjectRpcs,
  SessionRpcs,
  SettingRpcs,
  TabRpcs,
  TranscriptRpcs,
  WorktreeRpcs,
)
