import type { ViewDeclaration, ViewPlacement } from "@ivin/contracts/plugin"

// The user's setting, then the caller's, then the default; each only if it is one of the view's placements.
export const resolvePlacement = (
  declaration: Pick<ViewDeclaration, "placements" | "defaultPlacement">,
  setting: unknown,
  caller: ViewPlacement | undefined,
): ViewPlacement => {
  const allowed = (placement: unknown): placement is ViewPlacement =>
    declaration.placements.some((candidate) => candidate === placement)
  if (allowed(setting)) return setting
  if (caller !== undefined && allowed(caller)) return caller
  return declaration.defaultPlacement
}

export const placementSettingKey = (view: string) => `${view}.placement`
