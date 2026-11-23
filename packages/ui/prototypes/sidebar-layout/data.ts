import type { SessionStatus, WaitingFor } from "@ivin/contracts/session"

export interface FakeSession {
  readonly id: string
  readonly title: string
  readonly status: SessionStatus
  readonly waitingFor?: WaitingFor
  readonly branch: string | null
  readonly kind: "checkout" | "worktree"
  readonly ago: string
  readonly command?: string
}

export interface FakeProject {
  readonly name: string
  readonly sessions: ReadonlyArray<FakeSession>
}

let n = 0
const s = (o: Omit<FakeSession, "id">): FakeSession => ({ id: `s${++n}`, ...o })

export const PROJECTS: ReadonlyArray<FakeProject> = [
  {
    name: "ivin",
    sessions: [
      s({ title: "Implement ivin issue 80", status: "working", branch: "feat/80-strip-sidebar-layout", kind: "worktree", ago: "now" }),
      s({ title: "Branch picker for worktrees", status: "waiting", waitingFor: "approval", command: "pnpm add @base-ui/react", branch: "feat/21-branch-picker", kind: "worktree", ago: "4 min" }),
      s({ title: "Port the tab bar to the new layout", status: "idle", branch: "feat/12-tab-bar", kind: "worktree", ago: "22 min" }),
      s({ title: "Review the light theme contrast on the faint text", status: "idle", branch: "main", kind: "checkout", ago: "1 h" }),
      s({ title: "Remove the legacy settings view", status: "idle", branch: "refactor/settings-view", kind: "worktree", ago: "3 h" }),
    ],
  },
  {
    name: "silbo-api",
    sessions: [
      s({ title: "Require an accommodation for the overlap anomaly", status: "waiting", waitingFor: "question", branch: "fix/overlap-anomaly", kind: "worktree", ago: "2 min" }),
      s({ title: "Migrate the invoices job to the new queue", status: "waiting", waitingFor: "approval", command: "pnpm db:migrate --env staging", branch: "feat/invoices-queue", kind: "worktree", ago: "9 min" }),
      s({ title: "Speed up the bookings export", status: "working", branch: "perf/bookings-export", kind: "worktree", ago: "now" }),
    ],
  },
  {
    name: "dotfiles",
    sessions: [
      s({ title: "Clean up the zsh prompt", status: "idle", branch: "chore/zsh-prompt", kind: "checkout", ago: "2 d" }),
    ],
  },
  {
    name: "blog",
    sessions: [
      s({ title: "Draft the post on supervising agents", status: "idle", branch: "drafts/supervising-agents", kind: "checkout", ago: "5 h" }),
      s({ title: "Rewrite the getting started guide", status: "waiting", waitingFor: "approval", command: "rm -rf content/old-guides", branch: "docs/getting-started", kind: "worktree", ago: "12 min" }),
    ],
  },
  { name: "ivin-playground", sessions: [] },
  {
    name: "design-tokens",
    sessions: [
      s({ title: "Export the forest palette to Figma variables", status: "idle", branch: "main", kind: "checkout", ago: "1 d" }),
    ],
  },
  {
    name: "terraform-infra",
    sessions: [
      s({ title: "Plan the new artifacts bucket", status: "working", branch: "feat/artifacts-bucket", kind: "worktree", ago: "now" }),
    ],
  },
  { name: "advent-of-code-2026", sessions: [] },
]

export const waitingCount = (p: FakeProject) => p.sessions.filter((x) => x.status === "waiting").length
export const projectLabel = (p: FakeProject) => {
  const w = waitingCount(p)
  return w === 0 ? p.name : `${p.name} · ${w} waiting for you`
}
