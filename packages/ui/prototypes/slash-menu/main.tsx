import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Scene, type Variant } from "./scene.tsx"
import { OneLine, Preview, Sheet } from "./variants.tsx"

const scene = (variant: Variant) => () => <Scene variant={variant} />

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "One line", Component: scene({ placement: "popup", Menu: OneLine }) },
        { name: "Sheet", Component: scene({ placement: "docked", Menu: Sheet }) },
        { name: "Preview", Component: scene({ placement: "popup", Menu: Preview }) },
      ]}
    />
  </StrictMode>,
)
