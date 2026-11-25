import type { ViewParams } from "@ivin/plugin-api/ui"

// The task view's tab shows the task's name and kind before the view mounts, so the opener passes them.
export const taskTitle = (params: ViewParams) =>
  typeof params["description"] === "string" ? params["description"] : "Task"

export const taskIcon = (params: ViewParams) =>
  params["kind"] === "command" ? ("terminal" as const) : ("robot" as const)
