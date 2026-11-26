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

// A project folder chosen alone works like a project of its own.
// "all", or the path of one project folder.
export type Project = string

export type Where =
  | { readonly kind: "new" }
  | { readonly kind: "checkout" }
  | { readonly kind: "existing"; readonly path: string }

export interface Pick {
  readonly project: Project
  readonly where: Where
  // The checkout's branch after a pick in the branch menu.
  readonly branch?: string
}

export const PROJECT_WORKTREES: Readonly<
  Record<string, ReadonlyArray<{ path: string; branch: string; usedBy?: string }>>
> = {
  "/Users/paul/Dev/shop/api": [
    { path: "/Users/paul/Dev/shop/api/.worktrees/feat-rate-limit", branch: "feat/rate-limit" },
    {
      path: "/Users/paul/Dev/shop/api/.worktrees/ivin-5d01aa3e",
      branch: "ivin/5d01aa3e",
      usedBy: "Search by SKU",
    },
    { path: "/Users/paul/Dev/shop/api/.worktrees/feat-webhooks", branch: "feat/webhooks" },
    { path: "/Users/paul/Dev/shop/api/.worktrees/fix-rate-headers", branch: "fix/rate-headers" },
    { path: "/Users/paul/Dev/shop/api/.worktrees/feat-bulk-import", branch: "feat/bulk-import" },
    { path: "/Users/paul/Dev/shop/api/.worktrees/ivin-0c4e7f12", branch: "ivin/0c4e7f12" },
    {
      path: "/Users/paul/Dev/shop/api/.worktrees/chore-deps-november",
      branch: "chore/deps-november",
    },
    { path: "/Users/paul/Dev/shop/api/.worktrees/feat-audit-log", branch: "feat/audit-log" },
    { path: "/Users/paul/Dev/shop/api/.worktrees/fix-null-currency", branch: "fix/null-currency" },
    { path: "/Users/paul/Dev/shop/api/.worktrees/ivin-71ab03de", branch: "ivin/71ab03de" },
    {
      path: "/Users/paul/Dev/shop/api/.worktrees/feat-graphql-orders",
      branch: "feat/graphql-orders",
    },
    {
      path: "/Users/paul/Dev/shop/api/.worktrees/fix-timezone-reports",
      branch: "fix/timezone-reports",
    },
    { path: "/Users/paul/Dev/shop/api/.worktrees/ivin-e2290b6a", branch: "ivin/e2290b6a" },
    { path: "/Users/paul/Dev/shop/api/.worktrees/feat-refund-api", branch: "feat/refund-api" },
  ],
  "/Users/paul/Dev/shop/web": [
    { path: "/Users/paul/Dev/shop/web/.worktrees/feat-dark-mode-v2", branch: "feat/dark-mode-v2" },
  ],
  "/Users/paul/Dev/shop/docs": [],
}

export const PROJECT_BRANCHES: Readonly<Record<string, ReadonlyArray<string>>> = {
  "/Users/paul/Dev/shop/api": ["main", "feat/rate-limit", "fix/order-totals"],
  "/Users/paul/Dev/shop/web": ["main", "feat/dark-mode", "feat/dark-mode-v2"],
  "/Users/paul/Dev/shop/docs": [],
}
