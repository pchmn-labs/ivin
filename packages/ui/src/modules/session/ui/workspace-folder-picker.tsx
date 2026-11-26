import { Popover } from "@base-ui/react/popover"
import { useAtom, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { Session, WorkingFolderChoice } from "@ivin/contracts/session"
import type { ActionFailure, SessionLocationLabel } from "@ivin/plugin-api/ui"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon, type IconName } from "../../../core/components/icon/icon.tsx"
import { KeyHints } from "../../../core/components/key-hints/key-hints.tsx"
import { SearchField } from "../../../core/components/search-field/search-field.tsx"
import { newWorktreeBaseOf, worktreesOf } from "../../worktree/atoms/list-worktrees.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { pickWorkingFolderAtom } from "../atoms/pick-working-folder.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { listWorktreesFailure, pickWorkingFolderFailure } from "../rules/failure-message.ts"
import { folderName, newBranchLabel } from "../rules/session-location.ts"
import {
  sessionProjectFolder,
  workingFolderBranch,
  workspaceProject,
  type WorkspaceProject,
} from "../rules/workspace-location.ts"
import { BranchPicker } from "./branch-picker.tsx"
import "../../../core/components/composer-menu/composer-menu.css"
import "./working-folder-picker.css"
import "./workspace-folder-picker.css"

// As in every composer menu, a list longer than this gets a search field.
const SEARCH_FROM = 10

interface Place {
  readonly key: string
  // `move` picks at once; `choose` waits for the first message, which creates the worktree.
  readonly move?: WorkingFolderChoice
  readonly choose?: WorkingFolderChoice
  readonly icon: IconName
  readonly label: string
  readonly mono?: boolean
  readonly description?: string
  readonly hint?: string | undefined
  readonly checked: boolean
  // Dropped while a search narrows the list.
  readonly heading?: string | undefined
}

const projectName = (project: WorkspaceProject) =>
  project === "all" ? "All projects" : folderName(project)

const filtered = <T extends { label: string }>(rows: readonly T[], query: string) => {
  const needle = query.trim().toLowerCase()
  return needle === "" ? rows : rows.filter((row) => row.label.toLowerCase().includes(needle))
}

export function WorkspaceFolderPicker({
  session,
  location,
  folders,
}: {
  session: Session
  location: SessionLocationLabel
  folders: readonly string[]
}) {
  const [choice, setChoice] = useAtom(workingFolderChoiceOf(session.id))
  const current = workspaceProject(session, choice, folders)
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState<WorkspaceProject>(current)
  const [cursor, setCursor] = useState<WorkspaceProject>(current)
  const [column, setColumn] = useState<0 | 1>(1)
  const [active, setActive] = useState(0)
  const [projectQuery, setProjectQuery] = useState("")
  const [placeQuery, setPlaceQuery] = useState("")
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<ActionFailure | null>(null)
  const id = useId()
  const body = useRef<HTMLDivElement>(null)

  const listAtom = worktreesOf(shown === "all" ? session.projectPath : shown)
  const listed = useAtomValue(listAtom)
  const refreshList = useAtomRefresh(listAtom)
  const worktrees = AsyncResult.getOrElse(listed, () => [])
  // A workspace has no one base: each repository starts from its own default branch.
  const shownBase = AsyncResult.getOrElse(
    useAtomValue(newWorktreeBaseOf(shown === "all" ? (folders[0] ?? "") : shown)),
    () => null,
  )
  const base = AsyncResult.getOrElse(
    useAtomValue(newWorktreeBaseOf(current === "all" ? (folders[0] ?? "") : current)),
    () => null,
  )
  const sessions = useAtomValue(sessionsOf(session.projectPath).items)
  const pick = useAtomSet(pickWorkingFolderAtom, { mode: "promiseExit" })

  const usedBy = (path: string) =>
    sessions.find((other) => other.id !== session.id && other.workingFolder === path)?.title
  const here = (path: string) =>
    !(choice.kind === "new_worktree" && !session.started) && session.workingFolder === path
  const newHere =
    !session.started &&
    current === shown &&
    (choice.kind === "new_worktree" ||
      (shown === "all" && !session.inWorktree && sessionProjectFolder(session, folders) === null))

  const existing = worktrees.map((worktree, index): Place => ({
    key: worktree.path,
    move: { kind: "existing_worktree", path: worktree.path },
    icon: "worktree",
    label: worktree.repositories
      ? workingFolderBranch(worktree)
      : (worktree.branch ?? folderName(worktree.path)),
    mono: true,
    ...(usedBy(worktree.path) !== undefined && { hint: usedBy(worktree.path) }),
    checked: here(worktree.path),
    ...(index === 0 && { heading: "Existing worktrees" }),
  }))
  const places: Place[] =
    shown === "all"
      ? [
          {
            key: "new",
            choose: { kind: "new_worktree" },
            icon: "plus",
            label: "New worktrees",
            description: "One folder with a worktree of each project, all on one new branch",
            checked: newHere,
          },
          ...existing,
        ]
      : [
          {
            key: "checkout",
            move: { kind: "checkout", path: shown },
            icon: "folder",
            label: "Current checkout",
            checked: here(shown),
          },
          {
            key: "new",
            choose: { kind: "new_worktree", folder: shown },
            icon: "plus",
            label: "New worktree",
            description: `${newBranchLabel(shownBase, null)}, under .worktrees/`,
            checked: newHere,
          },
          ...existing,
        ]
  const projects = filtered(
    (["all", ...folders] as WorkspaceProject[]).map((project) => ({
      project,
      label: projectName(project),
    })),
    projectQuery,
  )
  const shownPlaces = filtered(places, placeQuery).map((place) =>
    placeQuery.trim() === "" ? place : { ...place, heading: undefined },
  )
  const projectsSearchable = folders.length + 1 > SEARCH_FROM
  const placesSearchable = places.length > SEARCH_FROM

  const show = (project: WorkspaceProject) => {
    setShown(project)
    setCursor(project)
    setPlaceQuery("")
    setActive(0)
    setColumn(1)
    setFailure(null)
  }

  useEffect(() => {
    if (!open) return
    const searchable = column === 0 ? projectsSearchable : placesSearchable
    if (!searchable) body.current?.focus()
  }, [open, column, shown, projectsSearchable, placesSearchable])
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-${column}-active`)?.scrollIntoView({ block: "nearest" })
  }, [open, column, active, cursor])

  const choose = async (place: Place) => {
    setFailure(null)
    if (place.choose !== undefined) {
      setChoice(place.choose)
      setOpen(false)
      return
    }
    if (place.move === undefined || pending) return
    setPending(true)
    const exit = await pick({
      projectPath: session.projectPath,
      sessionId: session.id,
      workingFolder: place.move,
    })
    setPending(false)
    if (Exit.isSuccess(exit)) {
      // The session is there now; a later message must not move it again.
      setChoice({ kind: "checkout" })
      setOpen(false)
    } else if (!Cause.hasInterruptsOnly(exit.cause)) {
      setFailure(pickWorkingFolderFailure(Cause.squash(exit.cause)))
    }
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const rows = column === 0 ? projects.length : shownPlaces.length
    const index = column === 0 ? projects.findIndex((row) => row.project === cursor) : active
    const query = column === 0 ? projectQuery : placeQuery
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && rows > 0) {
      const next = (index + (event.key === "ArrowDown" ? 1 : -1) + rows) % rows
      if (column === 0) setCursor(projects[next]!.project)
      else setActive(next)
    } else if (event.key === "ArrowRight" && column === 0) {
      if (projects.some((row) => row.project === cursor)) show(cursor)
    } else if (event.key === "ArrowLeft" && column === 1 && query === "") {
      setCursor(shown)
      setColumn(0)
    } else if (event.key === "Enter") {
      if (column === 0) {
        if (projects.some((row) => row.project === cursor)) show(cursor)
      } else if (shownPlaces[active] !== undefined) void choose(shownPlaces[active])
    } else return
    event.preventDefault()
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    setShown(current)
    setCursor(current)
    setColumn(1)
    setProjectQuery("")
    setPlaceQuery("")
    setFailure(null)
    refreshList()
  }

  return (
    <span className="iv-working-folder-picker">
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Trigger
          render={
            <button
              type="button"
              className="iv-working-folder-picker__trigger"
              data-kind={location.kind}
              data-testid="working-folder-picker"
              aria-label={`Working folder: ${location.label}`}
            >
              <Icon name={location.kind === "worktree" ? "worktree" : "folder"} size={12} />
              {location.label}
              <Icon name="chevron-down" size={12} />
            </button>
          }
        />
        <Popover.Portal>
          <Popover.Positioner
            side="top"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
          >
            <Popover.Popup
              className="iv-workspace-folder-picker"
              initialFocus={body}
              aria-label="Working folder"
            >
              <div
                ref={body}
                className="iv-workspace-folder-picker__columns"
                tabIndex={-1}
                onKeyDown={onKeyDown}
              >
                <div
                  className="iv-workspace-folder-picker__column"
                  role="listbox"
                  aria-label="Project"
                >
                  {projectsSearchable && (
                    <div className="iv-workspace-folder-picker__search" key={`projects-${column}`}>
                      <SearchField
                        label="Find a project"
                        placeholder="Find a project…"
                        value={projectQuery}
                        autoFocus={column === 0}
                        onChange={(value) => {
                          setProjectQuery(value)
                          setColumn(0)
                        }}
                        onEscape={() => setOpen(false)}
                      />
                    </div>
                  )}
                  <div className="iv-composer-menu__viewport iv-workspace-folder-picker__list">
                    {projects.length === 0 && (
                      <div className="iv-composer-menu__note">
                        No project matches “{projectQuery.trim()}”.
                      </div>
                    )}
                    {projects.map(({ project, label }, index) => (
                      <div key={project}>
                        {index === 1 && projects[0]?.project === "all" && (
                          <div className="iv-workspace-folder-picker__separator" />
                        )}
                        <div
                          id={column === 0 && project === cursor ? `${id}-0-active` : undefined}
                          role="option"
                          aria-selected={project === shown}
                          className="iv-composer-menu__item iv-workspace-folder-picker__project"
                          data-shown={project === shown || undefined}
                          data-highlighted={(column === 0 && project === cursor) || undefined}
                          onClick={() => show(project)}
                        >
                          <span className="iv-composer-menu__icon">
                            <Icon name={project === "all" ? "stack" : "folder"} size={14} />
                          </span>
                          <span className="iv-composer-menu__label" title={label}>
                            {label}
                          </span>
                          <span className="iv-composer-menu__check">
                            {project === shown && <Icon name="check" size={14} label="Shown" />}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="iv-workspace-folder-picker__foot">
                    <KeyHints
                      hints={[
                        { key: "↑↓ ←→", label: "Move" },
                        { key: "↵", label: "Pick" },
                        { key: "Esc", label: "Close" },
                      ]}
                    />
                  </div>
                </div>
                <div
                  className="iv-workspace-folder-picker__column iv-workspace-folder-picker__column--places"
                  role="listbox"
                  aria-label={`Working folders of ${projectName(shown)}`}
                >
                  {placesSearchable && (
                    <div
                      className="iv-workspace-folder-picker__search"
                      key={`places-${column}-${shown}`}
                    >
                      <SearchField
                        label={`Find a worktree of ${projectName(shown)}`}
                        placeholder={`Find a worktree of ${projectName(shown)}…`}
                        value={placeQuery}
                        autoFocus={column === 1}
                        onChange={(value) => {
                          setPlaceQuery(value)
                          setActive(0)
                          setColumn(1)
                        }}
                        onEscape={() => setOpen(false)}
                      />
                    </div>
                  )}
                  <div className="iv-composer-menu__viewport iv-workspace-folder-picker__list">
                    {shownPlaces.length === 0 && (
                      <div className="iv-composer-menu__note">
                        No worktree matches “{placeQuery.trim()}”.
                      </div>
                    )}
                    {shownPlaces.map((place, index) => (
                      <div key={place.key}>
                        {place.heading !== undefined && (
                          <div className="iv-composer-menu__heading iv-workspace-folder-picker__heading">
                            {place.heading}
                          </div>
                        )}
                        <div
                          id={column === 1 && index === active ? `${id}-1-active` : undefined}
                          role="option"
                          aria-selected={place.checked}
                          className="iv-composer-menu__item iv-workspace-folder-picker__place"
                          data-highlighted={(column === 1 && index === active) || undefined}
                          data-mono={place.mono || undefined}
                          data-described={place.description !== undefined || undefined}
                          onMouseMove={() => {
                            setColumn(1)
                            setActive(index)
                          }}
                          onClick={() => void choose(place)}
                        >
                          <span className="iv-composer-menu__icon">
                            <Icon name={place.icon} size={14} />
                          </span>
                          <span className="iv-workspace-folder-picker__text">
                            <span className="iv-composer-menu__label" title={place.label}>
                              {place.label}
                            </span>
                            {place.description !== undefined && (
                              <span className="iv-workspace-folder-picker__description">
                                {place.description}
                              </span>
                            )}
                          </span>
                          {place.hint !== undefined && (
                            <span className="iv-composer-menu__hint">{place.hint}</span>
                          )}
                          <span className="iv-composer-menu__check">
                            {place.checked && <Icon name="check" size={14} label="Chosen" />}
                          </span>
                        </div>
                      </div>
                    ))}
                    {AsyncResult.isFailure(listed) && (
                      <ErrorMessage message={listWorktreesFailure} onRetry={refreshList} />
                    )}
                    {failure !== null && <ErrorMessage message={failure.text} />}
                  </div>
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <WorkspaceBranch
        session={session}
        location={location}
        folders={folders}
        base={current === "all" ? null : base}
      />
    </span>
  )
}

// A project folder's branch can be switched, as on a project of its own; several are only shown.
export function WorkspaceBranch({
  session,
  location,
  folders,
  base = null,
}: {
  session: Session
  location: SessionLocationLabel
  folders: readonly string[]
  base?: string | null
}) {
  const repository = sessionProjectFolder(session, folders)
  if (location.branch === null) {
    if (location.kind !== "worktree") return null
    return (
      <span className="iv-working-folder-picker__branch">
        <Icon name="git-branch" size={12} />
        {newBranchLabel(base, null)}
      </span>
    )
  }
  if (repository !== null && location.deleted !== true) {
    return <BranchPicker session={session} branch={location.branch} repository={repository} />
  }
  return (
    <span className="iv-working-folder-picker__branch">
      <Icon name="git-branch" size={12} />
      <span className="iv-working-folder-picker__name">{location.branch}</span>
    </span>
  )
}
