import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Gauge, OneAction, Rows } from "./settings-variants.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      variants={[
        { name: "Rows", Component: Rows },
        { name: "Gauge", Component: Gauge },
        { name: "One action", Component: OneAction },
      ]}
    />
  </StrictMode>,
)
