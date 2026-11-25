import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Folded, Placeholder } from "./deleted-variants.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "Placeholder", Component: Placeholder },
        { name: "Folded", Component: Folded },
      ]}
    />
  </StrictMode>,
)
