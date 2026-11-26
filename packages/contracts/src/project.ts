import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

// `path` is the folder, or the `.code-workspace` file; `folders` are its project folders, read from
// that file each time, in its order.
export const Project = Schema.Struct({
  path: Schema.String,
  name: Schema.String,
  lastOpenedAt: Schema.DateTimeUtcFromMillis,
  folders: Schema.Array(Schema.String),
  workspace: Schema.Boolean,
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

// The folder is in no trusted project, and the call did not carry the user's trust.
// `folders`: the project folders of a workspace that are not trusted yet.
export class ProjectNotTrusted extends Schema.TaggedError<ProjectNotTrusted>()(
  "ProjectNotTrusted",
  { path: Schema.String, folders: Schema.optionalKey(Schema.Array(Schema.String)) },
) {}

// The `.code-workspace` file cannot be read, or lists no folder.
export class WorkspaceUnreadable extends Schema.TaggedError<WorkspaceUnreadable>()(
  "WorkspaceUnreadable",
  { path: Schema.String },
) {}

export const ProjectRpcs = RpcGroup.make(
  // Opens the folder at the end of the list, or keeps its place if already open, and selects it.
  // `trust` records the user's trust in the folder first.
  Rpc.make("project.open", {
    payload: { path: Schema.String, trust: Schema.optionalKey(Schema.Boolean) },
    success: OpenProjects,
    error: Schema.Union([ProjectNotTrusted, WorkspaceUnreadable]),
  }),
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
