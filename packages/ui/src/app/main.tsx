import { RegistryProvider } from "@effect/atom-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../core/theme/tokens.css"
import "../core/theme/base.css"
import { useUpdateStateBridge } from "../modules/update/hooks/use-update-state-bridge.ts"
import { useServerStateBridge } from "../modules/server/hooks/use-server-state-bridge.ts"
import { useStartupNoticeBridge } from "../modules/plugin/hooks/use-startup-notice-bridge.ts"
import { App } from "./app.tsx"
import { WindowFailureBoundary } from "./failure-boundary.tsx"

function DesktopApp() {
  useServerStateBridge()
  useUpdateStateBridge()
  useStartupNoticeBridge()
  return (
    <WindowFailureBoundary>
      <App />
    </WindowFailureBoundary>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RegistryProvider>
      <DesktopApp />
    </RegistryProvider>
  </StrictMode>,
)
