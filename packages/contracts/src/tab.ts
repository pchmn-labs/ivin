import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"
import { ProjectNotOpen } from "./project.ts"
import { SessionNotFound } from "./session.ts"

// The session id names the tab.
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

// A file of the session's working folder, or its uncommitted diff; `path` relative to it.
export const SubView = Schema.Struct({
  kind: Schema.Literals(["file", "diff"]),
  path: Schema.String,
})
export type SubView = typeof SubView.Type

// In the order they were opened; `selected` is null only when there are none.
// `sessionTabSelected` is only true in full width.
export const TabSubViews = Schema.Struct({
  sessionId: Schema.String,
  subViews: Schema.Array(SubView),
  selected: Schema.NullOr(SubView),
  fullWidth: Schema.Boolean,
  sessionTabSelected: Schema.Boolean,
})
export type TabSubViews = typeof TabSubViews.Type

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
  // Those opened in another working folder than the session's are closed first.
  Rpc.make("tab.listSubViews", {
    payload: { sessionId: Schema.String },
    success: TabSubViews,
    error: SessionNotFound,
  }),
  // Selects the sub-view, adding it at the end if the tab does not show it yet.
  Rpc.make("tab.openSubView", {
    payload: { sessionId: Schema.String, subView: SubView },
    success: TabSubViews,
    error: SessionNotFound,
  }),
  // Closing the selected sub-view selects its neighbour, as closing a tab does.
  Rpc.make("tab.closeSubView", {
    payload: { sessionId: Schema.String, subView: SubView },
    success: TabSubViews,
    error: SessionNotFound,
  }),
  Rpc.make("tab.setFullWidth", {
    payload: { sessionId: Schema.String, fullWidth: Schema.Boolean },
    success: TabSubViews,
    error: SessionNotFound,
  }),
  Rpc.make("tab.selectSessionTab", {
    payload: { sessionId: Schema.String },
    success: TabSubViews,
    error: SessionNotFound,
  }),
)
