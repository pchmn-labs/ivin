import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

// `when` names the area of the window the keybinding is limited to; null applies everywhere.
export const Keybinding = Schema.Struct({
  key: Schema.String,
  command: Schema.String,
  when: Schema.NullOr(Schema.String),
})
export type Keybinding = typeof Keybinding.Type

export const KeybindingsFileProblem = Schema.Struct({
  reason: Schema.Literals(["notJson", "notAList", "invalidEntry"]),
  // Position of the invalid entry in the list, from 1.
  entry: Schema.NullOr(Schema.Number),
})
export type KeybindingsFileProblem = typeof KeybindingsFileProblem.Type

// While the file is invalid, `keybindings` stays its last valid content.
export const UserKeybindings = Schema.Struct({
  keybindings: Schema.Array(Keybinding),
  problem: Schema.NullOr(KeybindingsFileProblem),
})
export type UserKeybindings = typeof UserKeybindings.Type

export const KeybindingRpcs = RpcGroup.make(
  Rpc.make("keybinding.watch", { success: UserKeybindings, stream: true }),
)
