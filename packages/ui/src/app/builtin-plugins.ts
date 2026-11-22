import approvalsPackage from "../../../../plugins/approvals/package.json"
import * as approvals from "../../../../plugins/approvals/src/ui.tsx"
import changesPackage from "../../../../plugins/changes/package.json"
import * as changes from "../../../../plugins/changes/src/ui.tsx"
import fileIconsPackage from "../../../../plugins/file-icons/package.json"
import * as fileIcons from "../../../../plugins/file-icons/src/ui.tsx"
import filesPackage from "../../../../plugins/files/package.json"
import * as files from "../../../../plugins/files/src/ui.tsx"
import inactiveSessionsPackage from "../../../../plugins/inactive-sessions/package.json"
import * as inactiveSessions from "../../../../plugins/inactive-sessions/src/ui.tsx"
import messagesPackage from "../../../../plugins/messages/package.json"
import * as messages from "../../../../plugins/messages/src/ui.tsx"
import toolCallsPackage from "../../../../plugins/tool-calls/package.json"
import * as toolCalls from "../../../../plugins/tool-calls/src/ui.tsx"
import usagePackage from "../../../../plugins/usage/package.json"
import * as usage from "../../../../plugins/usage/src/ui.tsx"
import workingPackage from "../../../../plugins/working/package.json"
import * as working from "../../../../plugins/working/src/ui.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"

export const builtinPlugins: ReadonlyArray<UiPluginEntry> = [
  { manifest: approvalsPackage.ivin, activate: approvals.activate },
  { manifest: fileIconsPackage.ivin, activate: fileIcons.activate },
  { manifest: filesPackage.ivin, activate: files.activate },
  { manifest: changesPackage.ivin, activate: changes.activate },
  { manifest: inactiveSessionsPackage.ivin, activate: inactiveSessions.activate },
  { manifest: messagesPackage.ivin, activate: messages.activate },
  { manifest: toolCallsPackage.ivin, activate: toolCalls.activate },
  { manifest: usagePackage.ivin, activate: usage.activate },
  { manifest: workingPackage.ivin, activate: working.activate },
]
