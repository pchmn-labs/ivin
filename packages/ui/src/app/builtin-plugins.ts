import approvalsManifest from "../../../../plugins/approvals/plugin.json"
import * as approvals from "../../../../plugins/approvals/ui.tsx"
import inactiveSessionsManifest from "../../../../plugins/inactive-sessions/plugin.json"
import * as inactiveSessions from "../../../../plugins/inactive-sessions/ui.tsx"
import messagesManifest from "../../../../plugins/messages/plugin.json"
import * as messages from "../../../../plugins/messages/ui.tsx"
import toolCallsManifest from "../../../../plugins/tool-calls/plugin.json"
import * as toolCalls from "../../../../plugins/tool-calls/ui.tsx"
import usageManifest from "../../../../plugins/usage/plugin.json"
import * as usage from "../../../../plugins/usage/ui.tsx"
import workingManifest from "../../../../plugins/working/plugin.json"
import * as working from "../../../../plugins/working/ui.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"

export const builtinPlugins: ReadonlyArray<UiPluginEntry> = [
  { manifest: approvalsManifest, activate: approvals.activate },
  { manifest: inactiveSessionsManifest, activate: inactiveSessions.activate },
  { manifest: messagesManifest, activate: messages.activate },
  { manifest: toolCallsManifest, activate: toolCalls.activate },
  { manifest: usageManifest, activate: usage.activate },
  { manifest: workingManifest, activate: working.activate },
]
