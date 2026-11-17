import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Project = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  lastOpenedAt: Schema.DateTimeUtcFromMillis,
})
export type Project = typeof Project.Type

export const ProjectRpcs = RpcGroup.make(
  Rpc.make("project.open", { payload: { path: Schema.String }, success: Project }),
  Rpc.make("project.getCurrent", { success: Schema.NullOr(Project) }),
)
