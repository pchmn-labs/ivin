import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

export const Project = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  lastOpenedAt: Schema.DateTimeUtcFromMillis,
})
export type Project = typeof Project.Type

export const OpenProjects = Schema.Struct({
  projects: Schema.Array(Project),
  selectedPath: Schema.NullOr(Schema.String),
})
export type OpenProjects = typeof OpenProjects.Type

export class ProjectNotOpen extends Schema.TaggedError<ProjectNotOpen>()("ProjectNotOpen", {
  path: Schema.String,
}) {}

// No project was ever opened at this path.
export class ProjectNotFound extends Schema.TaggedError<ProjectNotFound>()("ProjectNotFound", {
  path: Schema.String,
}) {}

export const ProjectRpcs = RpcGroup.make(
  // Opens the folder at the end of the list, or keeps its place if already open, and selects it.
  Rpc.make("project.open", { payload: { path: Schema.String }, success: OpenProjects }),
  // Closes the project's tabs too; its sessions are kept.
  Rpc.make("project.close", {
    payload: { path: Schema.String },
    success: OpenProjects,
    error: ProjectNotOpen,
  }),
  Rpc.make("project.select", {
    payload: { path: Schema.String },
    success: OpenProjects,
    error: ProjectNotOpen,
  }),
  Rpc.make("project.list", { success: OpenProjects }),
)
