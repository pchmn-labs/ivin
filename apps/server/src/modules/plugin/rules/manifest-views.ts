import type { ViewDeclaration, ViewPlacement } from "@ivin/contracts/plugin"
import type { PluginSettingDeclaration } from "@ivin/contracts/setting"

export type ManifestViewsReading =
  | { readonly kind: "valid"; readonly views: ReadonlyArray<ViewDeclaration> }
  | { readonly kind: "invalid"; readonly reason: string }

const NAME = /^[A-Za-z][A-Za-z0-9_-]*$/
const PLACEMENTS: ReadonlyArray<ViewPlacement> = ["subView", "sheet", "dialog"]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const invalid = (reason: string): ManifestViewsReading => ({ kind: "invalid", reason })

export const readManifestViews = (declared: unknown): ManifestViewsReading => {
  if (declared === undefined) return { kind: "valid", views: [] }
  if (!isRecord(declared)) return invalid("ivin.views in package.json must be an object.")
  const views: ViewDeclaration[] = []
  for (const [name, view] of Object.entries(declared)) {
    const at = `ivin.views.${name}`
    if (!NAME.test(name)) {
      return invalid(`${at} is not a valid name: use letters, digits, dashes and underscores.`)
    }
    if (!isRecord(view)) return invalid(`${at} in package.json must be an object.`)
    const { title, icon, placements, defaultPlacement, restore } = view
    if (typeof title !== "string" || title === "") {
      return invalid(`${at}.title must be a non-empty string.`)
    }
    if (typeof icon !== "string" || icon === "") {
      return invalid(`${at}.icon must be a non-empty string.`)
    }
    if (
      !Array.isArray(placements) ||
      placements.length === 0 ||
      !placements.every((item) => PLACEMENTS.includes(item as ViewPlacement)) ||
      new Set(placements).size !== placements.length
    ) {
      return invalid(
        `${at}.placements must be a non-empty list without duplicates of "subView", "sheet" or "dialog".`,
      )
    }
    if (!placements.includes(defaultPlacement)) {
      return invalid(`${at}.defaultPlacement must be one of ${placements.join(", ")}.`)
    }
    if (restore !== undefined && typeof restore !== "boolean") {
      return invalid(`${at}.restore must be a boolean.`)
    }
    views.push({
      name,
      title,
      icon,
      placements: placements as ViewPlacement[],
      defaultPlacement: defaultPlacement as ViewPlacement,
      restore: restore ?? true,
    })
  }
  return { kind: "valid", views }
}

const WHERE: Record<ViewPlacement, string> = {
  subView: "a tab beside the chat",
  sheet: "the sheet above the composer",
  dialog: "a dialog",
}

export const placementSettings = (
  pluginId: string,
  pluginName: string,
  views: ReadonlyArray<ViewDeclaration>,
): ReadonlyArray<PluginSettingDeclaration> =>
  views
    // A view with one placement has nothing to choose.
    .filter((view) => view.placements.length > 1)
    .map((view) => ({
      pluginId,
      pluginName,
      key: `${view.name}.placement`,
      type: "string" as const,
      default: view.defaultPlacement,
      values: view.placements,
      title: `${view.title} placement`,
      description: `Where ${view.title} opens: ${view.placements.map((placement) => WHERE[placement]).join(", or ")}.`,
    }))
