import type { ViewDeclaration, ViewPlacement } from "@ivin/contracts/plugin"

interface ManifestView {
  readonly title: string
  readonly icon: string
  readonly placements: ReadonlyArray<string>
  readonly defaultPlacement: string
  readonly restore?: boolean
}

// The views of a built-in plugin's own package.json, which the build already checks.
export const builtinViews = (
  views: Readonly<Record<string, ManifestView>> | undefined,
): ReadonlyArray<ViewDeclaration> =>
  Object.entries(views ?? {}).map(([name, view]) => ({
    name,
    title: view.title,
    icon: view.icon,
    placements: view.placements as ReadonlyArray<ViewPlacement>,
    defaultPlacement: view.defaultPlacement as ViewPlacement,
    restore: view.restore ?? true,
  }))
