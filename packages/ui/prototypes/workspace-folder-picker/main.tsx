import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "../../src/core/components/composer-menu/composer-menu.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Scene } from "./scene.tsx"
import { Columns, ProjectChips, TwoPickers } from "./riff2.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "Two pickers", Component: () => <Scene Location={TwoPickers} /> },
        { name: "Columns", Component: () => <Scene Location={Columns} /> },
        { name: "Project chips", Component: () => <Scene Location={ProjectChips} /> },
      ]}
    />
  </StrictMode>,
)
