import { Context } from "effect"

// `~/.ivin/worktrees`: the folder that holds the working folders of sessions on a workspace.
export class WorkingFolderRoot extends Context.Service<
  WorkingFolderRoot,
  { readonly path: string }
>()("ivin/server/WorkingFolderRoot") {}
