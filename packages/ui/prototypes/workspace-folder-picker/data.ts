export interface ProjectFolder {
  readonly name: string
  readonly path: string
  // Null when the folder is no git repository.
  readonly branch: string | null
}

export interface WorkingFolder {
  readonly path: string
  // Null when the worktrees' branches differ.
  readonly branch: string | null
  readonly repositories: ReadonlyArray<{ readonly name: string; readonly branch: string }>
  readonly usedBy?: string
}

export type Choice =
  | { readonly kind: "new" }
  | { readonly kind: "existing"; readonly path: string }
  | { readonly kind: "folder"; readonly path: string }

export const WORKSPACE = "shop"
export const BASE = "origin/main"

export const FOLDERS: ReadonlyArray<ProjectFolder> = [
  { name: "api", path: "/Users/paul/Dev/shop/api", branch: "main" },
  { name: "web", path: "/Users/paul/Dev/shop/web", branch: "feat/dark-mode" },
  { name: "docs", path: "/Users/paul/Dev/shop/docs", branch: null },
]

const root = "/Users/paul/.ivin/worktrees/shop"

export const WORKING_FOLDERS: ReadonlyArray<WorkingFolder> = [
  {
    path: `${root}/feat-search`,
    branch: "feat/search",
    repositories: [
      { name: "api", branch: "feat/search" },
      { name: "web", branch: "feat/search" },
    ],
  },
  {
    path: `${root}/ivin-3f2a1b9c`,
    branch: "ivin/3f2a1b9c",
    repositories: [
      { name: "api", branch: "ivin/3f2a1b9c" },
      { name: "web", branch: "ivin/3f2a1b9c" },
    ],
    usedBy: "Fix the cart total rounding",
  },
  {
    path: `${root}/ivin-77c0e2d4`,
    branch: null,
    repositories: [
      { name: "api", branch: "ivin/77c0e2d4" },
      { name: "web", branch: "fix/cart-badge" },
    ],
  },
]

export const folderName = (path: string) => path.slice(path.lastIndexOf("/") + 1)

export const sameChoice = (a: Choice, b: Choice) =>
  a.kind === b.kind && (a.kind === "new" || a.path === (b as { path: string }).path)

export const workingFolderOf = (path: string) => WORKING_FOLDERS.find((w) => w.path === path)!
export const projectFolderOf = (path: string) => FOLDERS.find((f) => f.path === path)!

// "api ivin/77c0e2d4 · web fix/cart-badge" when the branches differ.
export const branchesLabel = (folder: WorkingFolder) =>
  folder.branch ?? folder.repositories.map((r) => `${r.name} ${r.branch}`).join(" · ")
