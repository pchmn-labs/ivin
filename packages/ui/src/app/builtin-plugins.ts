import messagesManifest from "../../../../plugins/messages/plugin.json"
import * as messages from "../../../../plugins/messages/ui.tsx"
import toolCallsManifest from "../../../../plugins/tool-calls/plugin.json"
import * as toolCalls from "../../../../plugins/tool-calls/ui.tsx"
import usageManifest from "../../../../plugins/usage/plugin.json"
import * as usage from "../../../../plugins/usage/ui.tsx"
import type { UiPluginEntry } from "../modules/plugin/atoms/activate-plugin.ts"

export const builtinPlugins: ReadonlyArray<UiPluginEntry> = [
  { manifest: messagesManifest, activate: messages.activate },
  { manifest: toolCallsManifest, activate: toolCalls.activate },
  { manifest: usageManifest, activate: usage.activate },
]
