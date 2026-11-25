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

// Where an open view can move: its placements but the one it is in, in the manifest's order.
export const moveTargets = (
  declaration: Pick<ViewDeclaration, "placements"> | undefined,
  from: ViewPlacement,
): ReadonlyArray<ViewPlacement> =>
  declaration?.placements.filter((placement) => placement !== from) ?? []

export const placementNames: Record<ViewPlacement, string> = {
  subView: "Beside chat",
  sheet: "Sheet",
  dialog: "Dialog",
}

export const placementIcons = {
  subView: "split",
  sheet: "panel-bottom",
  dialog: "app-window",
} as const satisfies Record<ViewPlacement, string>
