import { AnnotationRpcs } from "./annotation.ts"
import { CliRpcs } from "./cli.ts"
import { FileRpcs } from "./file.ts"
import { KeybindingRpcs } from "./keybinding.ts"
import { LogRpcs } from "./log.ts"
import { PluginRpcs } from "./plugin.ts"
import { ProjectRpcs } from "./project.ts"
import { ServerRpcs } from "./server.ts"
import { SessionRpcs } from "./session.ts"
import { SettingRpcs } from "./setting.ts"
import { TabRpcs } from "./tab.ts"
import { TranscriptRpcs } from "./transcript.ts"
import { WorktreeRpcs } from "./worktree.ts"

export const Rpcs = ServerRpcs.merge(
  AnnotationRpcs,
  CliRpcs,
  FileRpcs,
  KeybindingRpcs,
  LogRpcs,
  PluginRpcs,
  ProjectRpcs,
  SessionRpcs,
  SettingRpcs,
  TabRpcs,
  TranscriptRpcs,
  WorktreeRpcs,
)
