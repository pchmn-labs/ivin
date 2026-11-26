import approvals from "../../../../../../plugins/approvals/package.json" with { type: "json" }
import changes from "../../../../../../plugins/changes/package.json" with { type: "json" }
import composer from "../../../../../../plugins/composer/package.json" with { type: "json" }
import fileIcons from "../../../../../../plugins/file-icons/package.json" with { type: "json" }
import github from "../../../../../../plugins/github/package.json" with { type: "json" }
import files from "../../../../../../plugins/files/package.json" with { type: "json" }
import inactiveSessions from "../../../../../../plugins/inactive-sessions/package.json" with { type: "json" }
import messages from "../../../../../../plugins/messages/package.json" with { type: "json" }
import prs from "../../../../../../plugins/prs/package.json" with { type: "json" }
import questions from "../../../../../../plugins/questions/package.json" with { type: "json" }
import sessions from "../../../../../../plugins/sessions/package.json" with { type: "json" }
import toolCalls from "../../../../../../plugins/tool-calls/package.json" with { type: "json" }
import usage from "../../../../../../plugins/usage/package.json" with { type: "json" }
import working from "../../../../../../plugins/working/package.json" with { type: "json" }

// Static like the UI's `builtin-plugins.ts`, so the server knows the settings of plugins it never loads.
export const builtinPackages: ReadonlyArray<string> = [
  JSON.stringify(approvals),
  JSON.stringify(changes),
  JSON.stringify(composer),
  JSON.stringify(fileIcons),
  JSON.stringify(files),
  JSON.stringify(github),
  JSON.stringify(inactiveSessions),
  JSON.stringify(messages),
  JSON.stringify(prs),
  JSON.stringify(questions),
  JSON.stringify(sessions),
  JSON.stringify(toolCalls),
  JSON.stringify(usage),
  JSON.stringify(working),
]
