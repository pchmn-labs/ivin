import { Context, Effect, Layer } from "effect"
import { NO_PERMISSIONS, type Permissions } from "../rules/permissions.ts"

// The permissions of the UI halves sent to the window, as their manifests were then.
export class UiHalfPermissions extends Context.Service<
  UiHalfPermissions,
  {
    readonly set: (id: string, from: "builtin" | "folder", permissions: Permissions) => void
    // A folder's plugin replaces the built-in one with its id.
    readonly of: (id: string) => Permissions
  }
>()("ivin/server/UiHalfPermissions") {}

export const layerUiHalfPermissions = Layer.effect(UiHalfPermissions)(
  Effect.sync(() => {
    const builtin = new Map<string, Permissions>()
    const folder = new Map<string, Permissions>()
    return {
      set: (id, from, permissions) =>
        void (from === "builtin" ? builtin : folder).set(id, permissions),
      of: (id) => folder.get(id) ?? builtin.get(id) ?? NO_PERMISSIONS,
    }
  }),
)
