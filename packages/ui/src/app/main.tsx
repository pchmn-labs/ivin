import { RegistryProvider } from "@effect/atom-react"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../core/theme/tokens.css"
import "../core/theme/base.css"
import { App } from "./app.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RegistryProvider>
      <App />
    </RegistryProvider>
  </StrictMode>,
)
