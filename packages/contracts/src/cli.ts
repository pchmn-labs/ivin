import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const ShellInstall = Schema.Struct({
  folder: Schema.String,
  path: Schema.String,
  // Whether the user's login shell has `folder` on its PATH; null when that PATH could not be read.
  onPath: Schema.NullOr(Schema.Boolean),
})
export type ShellInstall = typeof ShellInstall.Type

export const FolderRefusal = Schema.Literals([
  "permissionDenied",
  "readOnly",
  "notAFolder",
  "unknown",
])
export type FolderRefusal = typeof FolderRefusal.Type

export class ShellFoldersRefused extends Schema.TaggedError<ShellFoldersRefused>()(
  "ShellFoldersRefused",
  { folders: Schema.Array(Schema.Struct({ path: Schema.String, reason: FolderRefusal })) },
) {}

// An `ivin` that is not ivin's link already sits where the link would go.
export class ShellCommandNotOurs extends Schema.TaggedError<ShellCommandNotOurs>()(
  "ShellCommandNotOurs",
  { path: Schema.String },
) {}

export const CliRpcs = RpcGroup.make(
  // Null while no shell folder holds ivin's link.
  Rpc.make("cli.getShellInstall", { success: Schema.NullOr(ShellInstall) }),
  Rpc.make("cli.installInShell", {
    success: ShellInstall,
    error: Schema.Union([ShellFoldersRefused, ShellCommandNotOurs]),
  }),
)
