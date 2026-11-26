import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  ComposerMenu,
  type ComposerMenuGroup,
} from "../../src/core/components/composer-menu/composer-menu.tsx"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import { KeyHints } from "../../src/core/components/key-hints/key-hints.tsx"
import {
  BASE,
  FOLDERS,
  PROJECT_BRANCHES,
  PROJECT_WORKTREES,
  WORKING_FOLDERS,
  branchesLabel,
  folderName,
  projectFolderOf,
  workingFolderOf,
  type Pick,
  type Project,
  type Where,
} from "./data.ts"
import type { LocationProps } from "./scene.tsx"
import { List, usePopup, type Row } from "./variants.tsx"

const REPOSITORIES = FOLDERS.filter((f) => f.branch !== null).map((f) => f.name)
const START: Pick = { project: "all", where: { kind: "new" } }

const projectLabel = (project: Project) =>
  project === "all" ? "All projects" : projectFolderOf(project).name
const projectIcon = (project: Project): IconName => (project === "all" ? "stack" : "folder")
const isRepository = (project: Project) =>
  project === "all" || projectFolderOf(project).branch !== null

// What a project starts on when picked: new worktrees for all, else its checkout.
const defaultWhere = (project: Project): Where =>
  project === "all" ? { kind: "new" } : { kind: "checkout" }

const sameWhere = (a: Where, b: Where) =>
  a.kind === b.kind && (a.kind !== "existing" || a.path === (b as { path: string }).path)

interface WhereItem {
  readonly where: Where
  readonly key: string
  readonly icon: IconName
  readonly label: string
  readonly mono?: boolean
  readonly description?: string
  readonly hint?: string
  readonly heading?: string
}

const whereItems = (project: Project): WhereItem[] => {
  if (project === "all") {
    return [
      {
        where: { kind: "new" },
        key: "new",
        icon: "plus",
        label: "New worktrees",
        description: "One folder with a worktree of each project, all on one new branch",
      },
      ...WORKING_FOLDERS.map((folder, i): WhereItem => ({
        where: { kind: "existing", path: folder.path },
        key: folder.path,
        icon: "worktree",
        label: branchesLabel(folder),
        mono: true,
        ...(folder.usedBy !== undefined && { hint: folder.usedBy }),
        ...(i === 0 && { heading: "Existing worktrees" }),
      })),
    ]
  }
  if (!isRepository(project)) {
    return [
      {
        where: { kind: "checkout" },
        key: "checkout",
        icon: "folder",
        label: "Its folder",
        description: "Not a git repository",
      },
    ]
  }
  return [
    { where: { kind: "checkout" }, key: "checkout", icon: "folder", label: "Current checkout" },
    {
      where: { kind: "new" },
      key: "new",
      icon: "plus",
      label: "New worktree",
      description: `New branch from ${BASE}, under .worktrees/`,
    },
    ...(PROJECT_WORKTREES[project] ?? []).map((worktree, i): WhereItem => ({
      where: { kind: "existing", path: worktree.path },
      key: worktree.path,
      icon: "worktree",
      label: worktree.branch,
      mono: true,
      ...(worktree.usedBy !== undefined && { hint: worktree.usedBy }),
      ...(i === 0 && { heading: "Existing worktrees" }),
    })),
  ]
}

const whereLabel = (pick: Pick): { icon: IconName; label: string } => {
  const { project, where } = pick
  if (where.kind === "checkout") {
    return isRepository(project)
      ? { icon: "folder", label: "Current checkout" }
      : { icon: "folder", label: "Its folder" }
  }
  if (where.kind === "new") {
    return { icon: "worktree", label: project === "all" ? "New worktrees" : "New worktree" }
  }
  return { icon: "worktree", label: project === "all" ? "Worktrees" : "Worktree" }
}

const branchOf = (pick: Pick): ReactNode => {
  const { project, where } = pick
  if (where.kind === "new") return `New branch from ${BASE}`
  if (where.kind === "existing") {
    const label =
      project === "all"
        ? branchesLabel(workingFolderOf(where.path))
        : PROJECT_WORKTREES[project].find((w) => w.path === where.path)!.branch
    return <span className="proto-mono">{label}</span>
  }
  return null
}

function Ghost({
  icon,
  label,
  accent,
  open,
  fixed,
  ...rest
}: {
  icon: IconName
  label: ReactNode
  accent?: boolean
  open?: boolean
  fixed?: boolean
  onClick?: () => void
  ref?: React.Ref<HTMLButtonElement>
}) {
  return (
    <button
      {...rest}
      type="button"
      className="proto-trigger"
      data-kind={accent ? "worktree" : "folder"}
      data-popup-open={open ? "" : undefined}
      disabled={fixed}
    >
      <Icon name={icon} size={12} />
      {label}
      {!fixed && <Icon name="chevron-down" size={12} />}
    </button>
  )
}

// The checkout's branch is a menu, as on a project of its own; other branches are text.
function BranchPart({
  pick,
  onPick,
  fixed,
}: {
  pick: Pick
  onPick: (pick: Pick) => void
  fixed?: boolean
}) {
  const { project, where } = pick
  if (where.kind === "checkout" && project !== "all" && isRepository(project)) {
    const current = pick.branch ?? projectFolderOf(project).branch!
    const trigger = (
      <button type="button" className="proto-trigger proto-branch-trigger" disabled={fixed}>
        <Icon name="git-branch" size={12} />
        <span className="proto-mono">{current}</span>
        {!fixed && <Icon name="chevron-down" size={12} />}
      </button>
    )
    if (fixed) return trigger
    const groups: ComposerMenuGroup<string>[] = [
      {
        items: (PROJECT_BRANCHES[project] ?? []).map((branch) => ({
          value: branch,
          key: branch,
          label: branch,
          mono: true,
          checked: branch === current,
        })),
      },
    ]
    return (
      <ComposerMenu
        label="Branch"
        searchPlaceholder="Find a branch…"
        noMatch={(query) => `No branch matches “${query}”.`}
        groups={groups}
        onPick={(branch) => onPick({ ...pick, branch })}
        trigger={trigger}
      />
    )
  }
  const branch = branchOf(pick)
  if (branch === null) return null
  return (
    <span className="proto-branch">
      <Icon name="git-branch" size={12} />
      {branch}
    </span>
  )
}

function Started({ pick }: { pick: Pick }) {
  const where = whereLabel(pick)
  return (
    <span className="proto-location">
      <Ghost icon={projectIcon(pick.project)} label={projectLabel(pick.project)} fixed />
      <Ghost icon={where.icon} label={where.label} accent={where.icon === "worktree"} fixed />
      <BranchPart pick={pick} onPick={() => {}} fixed />
    </span>
  )
}

export function TwoPickers({ started }: LocationProps) {
  const [pick, setPick] = useState<Pick>(START)
  if (started) return <Started pick={pick} />
  const where = whereLabel(pick)
  const projects: ComposerMenuGroup<Project>[] = [
    {
      items: [
        {
          value: "all",
          key: "all",
          label: "All projects",
          icon: "stack",
          hint: REPOSITORIES.join(", "),
          checked: pick.project === "all",
        },
      ],
    },
    {
      label: "One project",
      items: FOLDERS.map((folder) => ({
        value: folder.path,
        key: folder.path,
        label: folder.name,
        icon: "folder" as const,
        hint: folder.branch ?? "not a repository",
        checked: pick.project === folder.path,
      })),
    },
  ]
  const items = whereItems(pick.project)
  const groups: ComposerMenuGroup<Where>[] = []
  for (const item of items) {
    if (groups.length === 0 || item.heading !== undefined)
      groups.push({ ...(item.heading !== undefined && { label: item.heading }), items: [] })
    ;(groups.at(-1)!.items as unknown[]).push({
      value: item.where,
      key: item.key,
      label: item.label,
      icon: item.icon,
      ...(item.mono && { mono: true }),
      ...(item.hint !== undefined && { hint: item.hint }),
      checked: sameWhere(item.where, pick.where),
    })
  }
  return (
    <span className="proto-location">
      <ComposerMenu
        label="Project"
        searchPlaceholder="Find a project…"
        noMatch={(query) => `No project matches “${query}”.`}
        groups={projects}
        onPick={(project) => setPick({ project, where: defaultWhere(project) })}
        trigger={<Ghost icon={projectIcon(pick.project)} label={projectLabel(pick.project)} />}
      />
      {items.length > 1 ? (
        <ComposerMenu
          label="Working folder"
          searchPlaceholder="Find a worktree…"
          noMatch={(query) => `No worktree matches “${query}”.`}
          groups={groups}
          onPick={(next) => setPick({ project: pick.project, where: next })}
          trigger={
            <Ghost icon={where.icon} label={where.label} accent={where.icon === "worktree"} />
          }
        />
      ) : (
        <Ghost icon={where.icon} label={where.label} fixed />
      )}
      <BranchPart pick={pick} onPick={setPick} />
    </span>
  )
}

// As in every composer menu, a list longer than this gets a search field.
const SEARCH_FROM = 10

const ALL_PROJECTS: Project[] = ["all", ...FOLDERS.map((f) => f.path)]

function OneTrigger({
  pick,
  popup,
  onOpen,
}: {
  pick: Pick
  popup: ReturnType<typeof usePopup>
  onOpen: () => void
}) {
  const where = whereLabel(pick)
  return (
    <Ghost
      ref={popup.trigger}
      icon={projectIcon(pick.project)}
      accent={where.icon === "worktree"}
      open={popup.open}
      label={
        <>
          {projectLabel(pick.project)}
          <span className="proto-sep">/</span>
          {where.label}
        </>
      }
      onClick={() => {
        onOpen()
        popup.setOpen(!popup.open)
      }}
    />
  )
}

export function Columns({ started }: LocationProps) {
  const [pick, setPick] = useState<Pick>(START)
  const popup = usePopup()
  // `project` is the one whose working folders show; `cursor` is where the keys are on the left.
  const [project, setProject] = useState<Project>(pick.project)
  const [cursor, setCursor] = useState<Project>(pick.project)
  const [column, setColumn] = useState<0 | 1>(1)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const all = whereItems(project)
  const searchable = all.length > SEARCH_FROM
  const needle = query.trim().toLowerCase()
  const items =
    needle === ""
      ? all
      : all
          .filter((item) => item.label.toLowerCase().includes(needle))
          .map((item): WhereItem => ({ ...item, heading: undefined }))
  const search = useRef<HTMLInputElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  useEffect(() => box.current?.focus(), [popup.open])
  useEffect(() => {
    if (column === 1 && searchable) search.current?.focus()
    else box.current?.focus()
  }, [column, project, searchable])
  useEffect(() => {
    viewport.current?.querySelector("[data-highlighted]")?.scrollIntoView({ block: "nearest" })
  }, [active, project, query])
  if (started) return <Started pick={pick} />

  const show = (p: Project) => {
    setQuery("")
    setProject(p)
    setCursor(p)
    setActive(0)
    setColumn(1)
  }
  const open = () => {
    setQuery("")
    setProject(pick.project)
    setCursor(pick.project)
    setColumn(1)
    setActive(
      Math.max(
        0,
        whereItems(pick.project).findIndex((i) => sameWhere(i.where, pick.where)),
      ),
    )
  }
  const choose = (where: Where) => {
    setPick({ project, where })
    popup.close()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation()
    const rows = column === 0 ? ALL_PROJECTS.length : items.length
    const index = column === 0 ? ALL_PROJECTS.indexOf(cursor) : active
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const next = (index + (event.key === "ArrowDown" ? 1 : -1) + rows) % rows
      if (column === 0) setCursor(ALL_PROJECTS[next])
      else setActive(next)
    } else if (event.key === "ArrowRight" && column === 0) {
      event.preventDefault()
      show(cursor)
    } else if (event.key === "ArrowLeft" && column === 1 && query === "") {
      event.preventDefault()
      setCursor(project)
      setColumn(0)
    } else if (event.key === "Enter") {
      event.preventDefault()
      if (column === 0) show(cursor)
      else if (items[active] !== undefined) choose(items[active].where)
    } else if (event.key === "Escape") {
      event.preventDefault()
      popup.close()
    }
  }
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <OneTrigger pick={pick} popup={popup} onOpen={open} />
        {popup.open && (
          <div
            className="iv-composer-menu proto-popup proto-columns"
            aria-label="Working folder"
            tabIndex={-1}
            ref={box}
            onKeyDown={onKeyDown}
          >
            <div className="proto-column proto-column--projects">
              <div className="iv-composer-menu__viewport">
                {ALL_PROJECTS.map((p, i) => (
                  <div key={p}>
                    {i === 1 && <div className="proto-separator" />}
                    <div
                      className="iv-composer-menu__item proto-project-row"
                      data-shown={p === project ? "" : undefined}
                      data-highlighted={column === 0 && p === cursor ? "" : undefined}
                      onClick={() => show(p)}
                    >
                      <span className="iv-composer-menu__icon">
                        <Icon name={projectIcon(p)} size={14} />
                      </span>
                      <span className="iv-composer-menu__label">{projectLabel(p)}</span>
                      <span className="iv-composer-menu__check">
                        {p === project && <Icon name="check" size={14} label="Shown" />}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="proto-foot">
                <KeyHints
                  hints={[
                    { key: "↑↓ ←→", label: "Move" },
                    { key: "↵", label: "Pick" },
                    { key: "Esc", label: "Close" },
                  ]}
                />
              </div>
            </div>
            <div className="proto-column proto-column--detail">
              {searchable && (
                <div className="iv-composer-menu__search">
                  <Icon name="search" size={14} />
                  <input
                    ref={search}
                    className="iv-composer-menu__input"
                    placeholder={`Find a worktree of ${projectLabel(project)}…`}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setActive(0)
                    }}
                    onFocus={() => setColumn(1)}
                  />
                </div>
              )}
              <div className="iv-composer-menu__viewport proto-scroll" ref={viewport}>
                {items.length === 0 && (
                  <div className="iv-composer-menu__note">
                    No worktree matches “{query.trim()}”.
                  </div>
                )}
                {items.map((item, i) => (
                  <div key={item.key}>
                    {item.heading !== undefined && (
                      <div className="iv-composer-menu__heading proto-heading">{item.heading}</div>
                    )}
                    <div
                      className="iv-composer-menu__item proto-row"
                      data-highlighted={column === 1 && i === active ? "" : undefined}
                      data-mono={item.mono || undefined}
                      data-described={item.description !== undefined || undefined}
                      onMouseMove={() => {
                        setColumn(1)
                        setActive(i)
                      }}
                      onClick={() => choose(item.where)}
                    >
                      <span className="iv-composer-menu__icon">
                        <Icon name={item.icon} size={14} />
                      </span>
                      <span className="proto-row__text">
                        <span className="iv-composer-menu__label">{item.label}</span>
                        {item.description !== undefined && (
                          <span className="proto-row__description">{item.description}</span>
                        )}
                      </span>
                      {item.hint !== undefined && (
                        <span className="iv-composer-menu__hint">{item.hint}</span>
                      )}
                      <span className="iv-composer-menu__check">
                        {project === pick.project && sameWhere(item.where, pick.where) && (
                          <Icon name="check" size={14} label="Chosen" />
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </span>
      <BranchPart pick={pick} onPick={setPick} />
    </span>
  )
}

export function ProjectChips({ started }: LocationProps) {
  const [pick, setPick] = useState<Pick>(START)
  const popup = usePopup()
  const [project, setProject] = useState<Project>(pick.project)
  if (started) return <Started pick={pick} />
  const rows: Row[] = whereItems(project).map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    ...(item.mono && { mono: true }),
    ...(item.description !== undefined && { description: item.description }),
    ...(item.hint !== undefined && { hint: item.hint }),
    ...(item.heading !== undefined && { heading: item.heading }),
    checked: project === pick.project && sameWhere(item.where, pick.where),
    act: () => {
      setPick({ project, where: item.where })
      popup.close()
    },
  }))
  const step = (by: 1 | -1) =>
    setProject(
      (p) =>
        ALL_PROJECTS[(ALL_PROJECTS.indexOf(p) + by + ALL_PROJECTS.length) % ALL_PROJECTS.length],
    )
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <OneTrigger pick={pick} popup={popup} onOpen={() => setProject(pick.project)} />
        {popup.open && (
          <div className="iv-composer-menu proto-popup proto-wide" aria-label="Working folder">
            <div className="proto-chips" role="tablist" aria-label="Project">
              {ALL_PROJECTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="tab"
                  aria-selected={p === project}
                  className="proto-chip"
                  data-active={p === project ? "" : undefined}
                  onClick={() => setProject(p)}
                >
                  <Icon name={projectIcon(p)} size={12} />
                  {projectLabel(p)}
                </button>
              ))}
            </div>
            <p className="proto-tab-note">
              {project === "all"
                ? `The agent works in ${REPOSITORIES.join(" and ")} together.`
                : `The agent works in ${folderName(project)}; it can read the other projects.`}
            </p>
            <div className="iv-composer-menu__viewport">
              <List key={project} rows={rows} onSide={step} onClose={popup.close} />
            </div>
            <div className="proto-footer">← → project · ↩ to pick · esc to close</div>
          </div>
        )}
      </span>
      <BranchPart pick={pick} onPick={setPick} />
    </span>
  )
}
