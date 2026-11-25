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

export const ViewParams = Schema.Record(Schema.String, Schema.Json)
export type ViewParams = typeof ViewParams.Type

// A view opened as a sub-view: `view` is "<plugin id>/<view name>", `params` a JSON object.
export const SubView = Schema.Struct({
  view: Schema.String,
  params: ViewParams,
})
export type SubView = typeof SubView.Type

// Keys sorted at every level, so equal params give equal text.
export const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .toSorted()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export const subViewKey = (subView: SubView) => `${subView.view}\n${canonicalJson(subView.params)}`

export const sameSubView = (a: SubView, b: SubView) => subViewKey(a) === subViewKey(b)

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
  // Selects the session's tab, creating it at the end of its project's bar, or right after `after`'s tab.
  Rpc.make("tab.open", {
    payload: { sessionId: Schema.String, after: Schema.optional(Schema.String) },
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
