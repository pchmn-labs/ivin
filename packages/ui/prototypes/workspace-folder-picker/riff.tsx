import { useState, type ReactNode } from "react"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import {
  BASE,
  FOLDERS,
  WORKING_FOLDERS,
  folderName,
  projectFolderOf,
  sameChoice,
  workingFolderOf,
  type Choice,
  type WorkingFolder,
} from "./data.ts"
import type { LocationProps } from "./scene.tsx"
import { Branch, List, usePopup, type Row } from "./variants.tsx"

const NEW: Choice = { kind: "new" }
const REPOSITORIES = FOLDERS.filter((f) => f.branch !== null).map((f) => f.name)
const repositoriesText = REPOSITORIES.join(" and ")

// "api and web on feat/search", or each repository's branch when they differ.
const branchesText = (folder: WorkingFolder) =>
  folder.branch === null
    ? folder.repositories.map((r) => `${r.name} on ${r.branch}`).join(", ")
    : `${folder.repositories.map((r) => r.name).join(" and ")} on ${folder.branch}`

const scope = (choice: Choice): { icon: IconName; label: string; branch: ReactNode } => {
  if (choice.kind === "folder") {
    const folder = projectFolderOf(choice.path)
    return {
      icon: "folder",
      label: folder.name,
      branch: folder.branch === null ? null : <span className="proto-mono">{folder.branch}</span>,
    }
  }
  if (choice.kind === "new") {
    return { icon: "stack", label: "All projects", branch: `New branch from ${BASE}` }
  }
  const folder = workingFolderOf(choice.path)
  return {
    icon: "stack",
    label: "All projects",
    branch: (
      <span className="proto-mono">
        {folder.branch ?? folder.repositories.map((r) => `${r.name} ${r.branch}`).join(" · ")}
      </span>
    ),
  }
}

function ScopeTrigger({
  choice,
  popup,
  onOpen,
}: {
  choice: Choice
  popup?: ReturnType<typeof usePopup>
  onOpen?: () => void
}) {
  const { icon, label } = scope(choice)
  return (
    <button
      ref={popup?.trigger}
      type="button"
      className="proto-trigger"
      data-kind={icon === "stack" ? "worktree" : "folder"}
      data-popup-open={popup?.open ? "" : undefined}
      disabled={popup === undefined}
      aria-label={`Working folder: ${label}`}
      onClick={() => {
        onOpen?.()
        popup?.setOpen(!popup.open)
      }}
    >
      <Icon name={icon} size={12} />
      {label}
      {popup !== undefined && <Icon name="chevron-down" size={12} />}
    </button>
  )
}

function Fixed({ choice }: { choice: Choice }) {
  return (
    <span className="proto-location">
      <ScopeTrigger choice={choice} />
      <Branch>{scope(choice).branch}</Branch>
    </span>
  )
}

const rowsFor = (choice: Choice, pick: (next: Choice) => void) => {
  const all: Row[] = [
    {
      key: "new",
      icon: "plus",
      label: "New branch",
      description: `A worktree of ${repositoriesText}, from ${BASE}`,
      checked: choice.kind === "new",
      act: () => pick(NEW),
    },
    ...WORKING_FOLDERS.map((folder): Row => ({
      key: folder.path,
      icon: "worktree",
      label: folder.branch ?? folderName(folder.path),
      mono: true,
      description:
        (folder.branch === null
          ? `Continue in ${branchesText(folder)}`
          : `Continue in the worktrees of ${folder.repositories.map((r) => r.name).join(" and ")}`) +
        (folder.usedBy === undefined ? "" : ` · also used by “${folder.usedBy}”`),
      checked: sameChoice(choice, { kind: "existing", path: folder.path }),
      act: () => pick({ kind: "existing", path: folder.path }),
    })),
  ]
  const one: Row[] = FOLDERS.map((folder) => ({
    key: folder.path,
    icon: "folder",
    label: folder.name,
    description:
      folder.branch === null
        ? "Not a git repository; the others stay readable"
        : `Its checkout, on ${folder.branch}; the others stay readable`,
    checked: sameChoice(choice, { kind: "folder", path: folder.path }),
    act: () => pick({ kind: "folder", path: folder.path }),
  }))
  return { all, one }
}

export function ByScope({ choice, onChoose, started }: LocationProps) {
  const popup = usePopup()
  if (started) return <Fixed choice={choice} />
  const { all, one } = rowsFor(choice, (next) => {
    onChoose(next)
    popup.close()
  })
  const rows = [
    { ...all[0]!, heading: `All projects · ${FOLDERS.map((f) => f.name).join(", ")}` },
    ...all.slice(1),
    { ...one[0]!, heading: "One project" },
    ...one.slice(1),
  ]
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <ScopeTrigger choice={choice} popup={popup} />
        {popup.open && (
          <div className="iv-composer-menu proto-popup proto-wide" aria-label="Working folder">
            <div className="iv-composer-menu__viewport proto-first-heading">
              <List rows={rows} onClose={popup.close} />
            </div>
          </div>
        )}
      </span>
      <Branch>{scope(choice).branch}</Branch>
    </span>
  )
}

type Tab = "all" | "one"

export function ScopeTabs({ choice, onChoose, started }: LocationProps) {
  const popup = usePopup()
  const [tab, setTab] = useState<Tab>(choice.kind === "folder" ? "one" : "all")
  if (started) return <Fixed choice={choice} />
  const { all, one } = rowsFor(choice, (next) => {
    onChoose(next)
    popup.close()
  })
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <ScopeTrigger
          choice={choice}
          popup={popup}
          onOpen={() => setTab(choice.kind === "folder" ? "one" : "all")}
        />
        {popup.open && (
          <div className="iv-composer-menu proto-popup proto-wide" aria-label="Working folder">
            <div className="proto-tabs" role="tablist">
              {(["all", "one"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className="proto-tab"
                  data-active={tab === id ? "" : undefined}
                  onClick={() => setTab(id)}
                >
                  <Icon name={id === "all" ? "stack" : "folder"} size={12} />
                  {id === "all" ? "All projects" : "One project"}
                </button>
              ))}
            </div>
            <p className="proto-tab-note">
              {tab === "all"
                ? `The agent works in ${repositoriesText} together, on one branch.`
                : "The agent starts in one project; it can still read the others."}
            </p>
            <div className="iv-composer-menu__viewport">
              <List
                key={tab}
                rows={tab === "all" ? all : one}
                onSide={() => setTab((t) => (t === "all" ? "one" : "all"))}
                onClose={popup.close}
              />
            </div>
            <div className="proto-footer">← → to switch · ↩ to pick · esc to close</div>
          </div>
        )}
      </span>
      <Branch>{scope(choice).branch}</Branch>
    </span>
  )
}

export function ProjectsFirst({ choice, onChoose, started }: LocationProps) {
  const popup = usePopup()
  const [page, setPage] = useState<"projects" | "all">("projects")
  if (started) return <Fixed choice={choice} />
  const pick = (next: Choice) => {
    onChoose(next)
    popup.close()
  }
  const { all, one } = rowsFor(choice, pick)
  const projects: Row[] = [
    {
      key: "all",
      icon: "stack",
      label: "All projects",
      description:
        choice.kind === "existing"
          ? `Continue in ${branchesText(workingFolderOf(choice.path))}`
          : `${repositoriesText} together, each in a worktree`,
      checked: choice.kind !== "folder",
      drill: true,
      act: () => setPage("all"),
    },
    ...one.map((row, i) => ({ ...row, ...(i === 0 && { heading: "One project" }) })),
  ]
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <ScopeTrigger choice={choice} popup={popup} onOpen={() => setPage("projects")} />
        {popup.open && (
          <div className="iv-composer-menu proto-popup proto-wide" aria-label="Working folder">
            {page === "all" && (
              <button type="button" className="proto-back" onClick={() => setPage("projects")}>
                <Icon name="arrow-left" size={12} />
                All projects: which branch?
              </button>
            )}
            <div className="iv-composer-menu__viewport">
              <List
                key={page}
                rows={page === "projects" ? projects : all}
                {...(page === "all" && { onBack: () => setPage("projects") })}
                onClose={popup.close}
              />
            </div>
            <div className="proto-footer">
              {page === "projects" ? "→ to choose the branch" : "← back"} · ↩ to pick · esc to close
            </div>
          </div>
        )}
      </span>
      <Branch>{scope(choice).branch}</Branch>
    </span>
  )
}
