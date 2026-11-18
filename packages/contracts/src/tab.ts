import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { ProjectNotOpen } from "./project.ts"
import { SessionNotFound } from "./session.ts"

// A session has at most one tab, so its id names the tab.
export const Tab = Schema.Struct({
  sessionId: Schema.String,
  projectPath: Schema.String,
})
export type Tab = typeof Tab.Type

export const ProjectTabs = Schema.Struct({
  projectPath: Schema.String,
  tabs: Schema.Array(Tab),
  selectedSessionId: Schema.NullOr(Schema.String),
})
export type ProjectTabs = typeof ProjectTabs.Type

export const TabRpcs = RpcGroup.make(
  // Selects the session's tab, creating it at the end of its project's bar if it has none.
  Rpc.make("tab.open", {
    payload: { sessionId: Schema.String },
    success: ProjectTabs,
    error: Schema.Union([SessionNotFound, ProjectNotOpen]),
  }),
  Rpc.make("tab.close", {
    payload: { sessionId: Schema.String },
    success: ProjectTabs,
    error: SessionNotFound,
  }),
  // Tabs missing from `sessionIds` keep their relative order after the named ones.
  Rpc.make("tab.reorder", {
    payload: { projectPath: Schema.String, sessionIds: Schema.Array(Schema.String) },
    success: ProjectTabs,
  }),
  Rpc.make("tab.list", { payload: { projectPath: Schema.String }, success: ProjectTabs }),
)
