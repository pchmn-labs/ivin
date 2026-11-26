import type { Session } from "@ivin/contracts/session"
import { isWorkspaceFile } from "../../project/rules/workspace-file.ts"

// Its first message creates its working folder; until then `workingFolder` is the workspace file.
export const awaitsWorkspaceFolder = (
  session: Pick<Session, "projectPath" | "started" | "inWorktree">,
) => isWorkspaceFile(session.projectPath) && !session.started && !session.inWorktree
