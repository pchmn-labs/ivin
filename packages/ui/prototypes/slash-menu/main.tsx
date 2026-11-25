import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Scene, type Variant } from "./scene.tsx"
import { bySource, sheet } from "./variants.tsx"

const scene = (variant: Variant) => () => <Scene variant={variant} />

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "Label", Component: scene({ placement: "docked", Menu: sheet("label") }) },
        { name: "One tag", Component: scene({ placement: "docked", Menu: sheet("tag") }) },
        {
          name: "Groups",
          Component: scene({ placement: "docked", Menu: sheet("groups"), order: bySource }),
        },
      ]}
    />
  </StrictMode>,
)
