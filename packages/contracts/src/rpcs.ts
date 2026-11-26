import type { RpcGroup } from "effect/rpc"
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

type AnyRpc = RpcGroup.Rpcs<typeof Rpcs>

// A new `ivin` command adds the RPCs it calls here.
const cliSocketTags = [
  "annotation.add",
  "plugin.check",
  "plugin.create",
  "plugin.lock",
  "plugin.readLog",
  "plugin.reload",
  "plugin.run",
  "plugin.setEnabled",
  "plugin.status",
  "server.doctor",
  "session.rename",
  "setting.get",
  "setting.set",
] as const satisfies ReadonlyArray<AnyRpc["_tag"]>

const isCliSocketTag = (tag: string) => (cliSocketTags as ReadonlyArray<string>).includes(tag)

export const CliSocketRpcs = Rpcs.omit(
  ...([...Rpcs.requests.keys()].filter((tag) => !isCliSocketTag(tag)) as AnyRpc["_tag"][]),
) as unknown as RpcGroup.RpcGroup<
  Extract<AnyRpc, { readonly _tag: (typeof cliSocketTags)[number] }>
>
