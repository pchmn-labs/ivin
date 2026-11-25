import { Layer } from "effect"
import { SessionsWithTab } from "../../transcript/usecases/sessions-with-tab.ts"
import { TabStore } from "./tab-store.ts"

export const layerSessionsWithTab = Layer.effect(SessionsWithTab)(
  TabStore.useSync((tabs) => ({ ids: tabs.sessionIds })),
)
