import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Scene, type Variant } from "./scene.tsx"
import { Direct, Overflow, TabMenus } from "./variants.tsx"

const scene = (variant: Variant) => () => <Scene variant={variant} />

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "Overflow", Component: scene(Overflow) },
        { name: "Tab menu", Component: scene(TabMenus) },
        { name: "Direct", Component: scene(Direct) },
      ]}
    />
  </StrictMode>,
)
