import type { ViewDeclaration } from "@ivin/contracts/plugin"
import type { ViewOptions } from "@ivin/plugin-api/ui"

export interface DeclaredView extends ViewDeclaration {
  // "<plugin id>/<view name>"
  readonly id: string
  readonly pluginId: string
}

export interface RegisteredView extends Partial<Pick<ViewOptions, "title" | "icon">> {
  readonly id: string
  readonly pluginId: string
  readonly component: ViewOptions["component"]
}
