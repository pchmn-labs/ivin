import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "../../src/core/theme/tokens.css"
import "../../src/core/theme/base.css"
import "../../src/core/components/composer-menu/composer-menu.css"
import "./picker.css"
import "./prototype.css"
import { Harness } from "./harness.tsx"
import { Scene } from "./scene.tsx"
import { KindFirst, OneList, WhatTheAgentGets } from "./variants.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness
      position="top"
      variants={[
        { name: "One list", Component: () => <Scene Location={OneList} /> },
        { name: "Kind first", Component: () => <Scene Location={KindFirst} /> },
        { name: "What the agent gets", Component: () => <Scene Location={WhatTheAgentGets} /> },
      ]}
    />
  </StrictMode>,
)
