import { RegistryProvider } from "@effect/atom-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../core/theme/tokens.css"
import "../core/theme/base.css"
import { useServerStateBridge } from "../modules/server/hooks/use-server-state-bridge.ts"
import { App } from "./app.tsx"

function DesktopApp() {
  useServerStateBridge()
  return <App />
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RegistryProvider>
      <DesktopApp />
    </RegistryProvider>
  </StrictMode>,
)
