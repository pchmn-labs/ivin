import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { KeybindingsFileProblem } from "./keybinding.ts"
import { Harness, HarnessRunOptions } from "./session.ts"
import { SettingsFileProblem } from "./setting.ts"

export const ServerVersion = Schema.Struct({ version: Schema.String })
export type ServerVersion = typeof ServerVersion.Type

export const HarnessInfo = Schema.Struct({ id: Harness, runOptions: HarnessRunOptions })
export type HarnessInfo = typeof HarnessInfo.Type

export const HarnessProgram = Schema.Struct({
  name: Schema.String,
  // Null when the program is not on the PATH the server spawns agents with.
  path: Schema.NullOr(Schema.String),
})
export type HarnessProgram = typeof HarnessProgram.Type

export const SkillInstall = Schema.Struct({
  name: Schema.String,
  path: Schema.String,
  status: Schema.Literals(["installed", "updated", "upToDate", "notOurs", "failed"]),
})
export type SkillInstall = typeof SkillInstall.Type

export const Diagnosis = Schema.Struct({
  version: Schema.String,
  settings: Schema.Struct({ path: Schema.String, problem: Schema.NullOr(SettingsFileProblem) }),
  keybindings: Schema.Struct({
    path: Schema.String,
    problem: Schema.NullOr(KeybindingsFileProblem),
  }),
  // Null for a harness that runs no program.
  harness: Schema.Struct({ id: Harness, program: Schema.NullOr(HarnessProgram) }),
  // Empty for a harness that takes no skills.
  skills: Schema.Array(SkillInstall),
})
export type Diagnosis = typeof Diagnosis.Type

export const ServerRpcs = RpcGroup.make(
  Rpc.make("server.getVersion", { success: ServerVersion }),
  // The harness the server runs, which every session it creates runs on.
  Rpc.make("server.getHarness", { success: HarnessInfo }),
  Rpc.make("server.doctor", { success: Diagnosis }),
)
