import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "../../src/core/components/composer-menu/composer-menu.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Scene } from "./scene.tsx"
import { ByScope, ProjectsFirst, ScopeTabs } from "./riff.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "By scope", Component: () => <Scene Location={ByScope} /> },
        { name: "Scope tabs", Component: () => <Scene Location={ScopeTabs} /> },
        { name: "Projects first", Component: () => <Scene Location={ProjectsFirst} /> },
      ]}
    />
  </StrictMode>,
)
