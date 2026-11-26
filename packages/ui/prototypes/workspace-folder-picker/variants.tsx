import { forwardRef, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import {
  ComposerMenu,
  type ComposerMenuGroup,
} from "../../src/core/components/composer-menu/composer-menu.tsx"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import {
  BASE,
  FOLDERS,
  WORKING_FOLDERS,
  branchesLabel,
  folderName,
  projectFolderOf,
  sameChoice,
  workingFolderOf,
  type Choice,
  type WorkingFolder,
} from "./data.ts"
import type { LocationProps } from "./scene.tsx"

const NEW: Choice = { kind: "new" }

const location = (choice: Choice): { icon: IconName; label: string; branch: ReactNode } => {
  if (choice.kind === "new") {
    return { icon: "worktree", label: "New worktrees", branch: `New branch from ${BASE}` }
  }
  if (choice.kind === "existing") {
    const folder = workingFolderOf(choice.path)
    return {
      icon: "worktree",
      label: "Worktrees",
      branch: <span className="proto-mono">{branchesLabel(folder)}</span>,
    }
  }
  const folder = projectFolderOf(choice.path)
  return {
    icon: "folder",
    label: folder.name,
    branch: folder.branch === null ? null : <span className="proto-mono">{folder.branch}</span>,
  }
}

const Trigger = forwardRef<
  HTMLButtonElement,
  { choice: Choice; open?: boolean; onClick?: () => void; static?: boolean }
>(function Trigger({ choice, open, onClick, static: fixed, ...rest }, ref) {
  const { icon, label } = location(choice)
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className="proto-trigger"
      data-kind={icon}
      data-popup-open={open ? "" : undefined}
      disabled={fixed}
      aria-label={`Working folder: ${label}`}
      onClick={onClick}
    >
      <Icon name={icon} size={12} />
      {label}
      {!fixed && <Icon name="chevron-down" size={12} />}
    </button>
  )
})

export function Branch({ children }: { children: ReactNode }) {
  if (children === null) return null
  return (
    <span className="proto-branch">
      <Icon name="git-branch" size={12} />
      {children}
    </span>
  )
}

function Started({ choice }: { choice: Choice }) {
  return (
    <span className="proto-location">
      <Trigger choice={choice} static />
      <Branch>{location(choice).branch}</Branch>
    </span>
  )
}

const branchesHint = (folder: WorkingFolder) => folder.usedBy ?? folderName(folder.path)

export function OneList({ choice, onChoose, started }: LocationProps) {
  if (started) return <Started choice={choice} />
  const groups: ComposerMenuGroup<Choice>[] = [
    {
      items: [
        {
          value: NEW,
          key: "new",
          label: "New worktrees",
          icon: "plus",
          checked: choice.kind === "new",
        },
      ],
    },
    {
      label: "Existing worktrees",
      items: WORKING_FOLDERS.map((folder) => ({
        value: { kind: "existing", path: folder.path } as const,
        key: folder.path,
        label: branchesLabel(folder),
        icon: "worktree" as const,
        mono: true,
        hint: branchesHint(folder),
        checked: sameChoice(choice, { kind: "existing", path: folder.path }),
      })),
    },
    {
      label: "One project folder",
      items: FOLDERS.map((folder) => ({
        value: { kind: "folder", path: folder.path } as const,
        key: folder.path,
        label: folder.name,
        icon: "folder" as const,
        hint: folder.branch ?? "not a repository",
        checked: sameChoice(choice, { kind: "folder", path: folder.path }),
      })),
    },
  ]
  return (
    <span className="proto-location">
      <ComposerMenu
        label="Working folder"
        searchPlaceholder="Find a worktree or folder…"
        noMatch={(query) => `Nothing matches “${query}”.`}
        groups={groups}
        onPick={onChoose}
        trigger={<Trigger choice={choice} />}
      />
      <Branch>{location(choice).branch}</Branch>
    </span>
  )
}

export function usePopup() {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: MouseEvent) => {
      if (!anchor.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", outside)
    return () => document.removeEventListener("mousedown", outside)
  }, [open])
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  return { open, setOpen, close, anchor, trigger }
}

export interface Row {
  readonly key: string
  readonly icon: IconName
  readonly label: string
  readonly mono?: boolean
  readonly description?: string
  readonly hint?: string
  readonly checked?: boolean
  readonly drill?: boolean
  readonly heading?: string
  readonly act: () => void
}

// A keyboard list: Up and Down move, Enter or Right acts, Left goes back, Escape closes.
export function List({
  rows,
  onBack,
  onSide,
  onClose,
  onHighlight,
}: {
  rows: ReadonlyArray<Row>
  onBack?: () => void
  onSide?: (step: 1 | -1) => void
  onClose: () => void
  onHighlight?: (row: Row) => void
}) {
  const [active, setActive] = useState(
    Math.max(
      0,
      rows.findIndex((r) => r.checked),
    ),
  )
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => list.current?.focus(), [rows])
  useEffect(() => {
    const row = rows[active]
    if (row) onHighlight?.(row)
  }, [active, rows])
  const onKeyDown = (event: KeyboardEvent) => {
    // The picker's own keys must not reach the harness, which flips variants on arrows.
    event.stopPropagation()
    const move = (step: number) => {
      event.preventDefault()
      setActive((i) => (i + step + rows.length) % rows.length)
    }
    if (event.key === "ArrowDown") move(1)
    else if (event.key === "ArrowUp") move(-1)
    else if (event.key === "Enter" || (event.key === "ArrowRight" && rows[active]?.drill)) {
      event.preventDefault()
      rows[active]?.act()
    } else if ((event.key === "ArrowLeft" || event.key === "Backspace") && onBack) {
      event.preventDefault()
      onBack()
    } else if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && onSide) {
      event.preventDefault()
      onSide(event.key === "ArrowLeft" ? -1 : 1)
    } else if (event.key === "Escape") {
      event.preventDefault()
      onClose()
    }
  }
  return (
    <div className="proto-list" role="listbox" tabIndex={-1} ref={list} onKeyDown={onKeyDown}>
      {rows.map((row, i) => (
        <div key={row.key}>
          {row.heading !== undefined && (
            <div className="iv-composer-menu__heading proto-heading">{row.heading}</div>
          )}
          <div
            role="option"
            aria-selected={row.checked ?? false}
            className="iv-composer-menu__item proto-row"
            data-highlighted={i === active ? "" : undefined}
            data-mono={row.mono || undefined}
            data-described={row.description !== undefined || undefined}
            onMouseMove={() => setActive(i)}
            onClick={row.act}
          >
            <span className="iv-composer-menu__icon">
              <Icon name={row.icon} size={14} />
            </span>
            <span className="proto-row__text">
              <span className="iv-composer-menu__label">{row.label}</span>
              {row.description !== undefined && (
                <span className="proto-row__description">{row.description}</span>
              )}
            </span>
            {row.hint !== undefined && <span className="iv-composer-menu__hint">{row.hint}</span>}
            {row.drill ? (
              <span className="proto-row__drill">
                <Icon name="chevron-right" size={12} />
              </span>
            ) : (
              <span className="iv-composer-menu__check">
                {row.checked && <Icon name="check" size={14} label="Chosen" />}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function KindFirst({ choice, onChoose, started }: LocationProps) {
  const popup = usePopup()
  const [page, setPage] = useState<"kinds" | "existing" | "folder">("kinds")
  if (started) return <Started choice={choice} />
  const pick = (next: Choice) => {
    onChoose(next)
    popup.close()
  }
  const kinds: Row[] = [
    {
      key: "new",
      icon: "plus",
      label: "New worktrees",
      description: `A new branch in each repository, from ${BASE}`,
      checked: choice.kind === "new",
      act: () => pick(NEW),
    },
    {
      key: "existing",
      icon: "worktree",
      label: "Existing worktrees",
      description:
        choice.kind === "existing"
          ? branchesLabel(workingFolderOf(choice.path))
          : `${WORKING_FOLDERS.length} working folders of earlier sessions`,
      checked: choice.kind === "existing",
      drill: true,
      act: () => setPage("existing"),
    },
    {
      key: "folder",
      icon: "folder",
      label: "One project folder",
      description:
        choice.kind === "folder"
          ? `${projectFolderOf(choice.path).name}, the others as extra directories`
          : "Its checkout, the others as extra directories",
      checked: choice.kind === "folder",
      drill: true,
      act: () => setPage("folder"),
    },
  ]
  const existing: Row[] = WORKING_FOLDERS.map((folder) => ({
    key: folder.path,
    icon: "worktree",
    label: folder.branch ?? `${folder.repositories.length} branches`,
    mono: folder.branch !== null,
    description:
      folder.branch === null
        ? folder.repositories.map((r) => `${r.name} ${r.branch}`).join(" · ")
        : folderName(folder.path),
    ...(folder.usedBy !== undefined && { hint: folder.usedBy }),
    checked: sameChoice(choice, { kind: "existing", path: folder.path }),
    act: () => pick({ kind: "existing", path: folder.path }),
  }))
  const folders: Row[] = FOLDERS.map((folder) => ({
    key: folder.path,
    icon: "folder",
    label: folder.name,
    description: folder.branch === null ? "Not a git repository" : `On ${folder.branch}`,
    checked: sameChoice(choice, { kind: "folder", path: folder.path }),
    act: () => pick({ kind: "folder", path: folder.path }),
  }))
  const back = () => setPage("kinds")
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <Trigger
          ref={popup.trigger}
          choice={choice}
          open={popup.open}
          onClick={() => {
            setPage("kinds")
            popup.setOpen(!popup.open)
          }}
        />
        {popup.open && (
          <div className="iv-composer-menu proto-popup" aria-label="Working folder">
            {page !== "kinds" && (
              <button type="button" className="proto-back" onClick={back}>
                <Icon name="arrow-left" size={12} />
                {page === "existing" ? "Existing worktrees" : "One project folder"}
              </button>
            )}
            <div className="iv-composer-menu__viewport">
              <List
                key={page}
                rows={page === "kinds" ? kinds : page === "existing" ? existing : folders}
                {...(page !== "kinds" && { onBack: back })}
                onClose={popup.close}
              />
            </div>
            <div className="proto-footer">
              {page === "kinds" ? "→ to open" : "← back"} · ↩ to pick · esc to close
            </div>
          </div>
        )}
      </span>
      <Branch>{location(choice).branch}</Branch>
    </span>
  )
}

interface Outcome {
  readonly folder: string
  readonly icon: IconName
  readonly what: string
  readonly branch?: string
  readonly starts?: boolean
}

// Each project folder, and what the agent gets of it with `choice`.
const outcomes = (choice: Choice): Outcome[] =>
  FOLDERS.map((folder): Outcome => {
    if (choice.kind === "folder") {
      if (choice.path !== folder.path) {
        return { folder: folder.name, icon: "folder", what: "Extra directory" }
      }
      return {
        folder: folder.name,
        icon: "folder",
        what: folder.branch === null ? "Starts here" : "Starts in its checkout",
        ...(folder.branch !== null && { branch: folder.branch }),
        starts: true,
      }
    }
    if (folder.branch === null) {
      return { folder: folder.name, icon: "folder", what: "Extra directory, not a repository" }
    }
    if (choice.kind === "new") {
      return {
        folder: folder.name,
        icon: "worktree",
        what: "New worktree",
        branch: "ivin/9b1e4c07",
      }
    }
    const repository = workingFolderOf(choice.path).repositories.find((r) => r.name === folder.name)
    return {
      folder: folder.name,
      icon: "worktree",
      what: "Worktree",
      ...(repository !== undefined && { branch: repository.branch }),
    }
  })

export function WhatTheAgentGets({ choice, onChoose, started }: LocationProps) {
  const popup = usePopup()
  const [shown, setShown] = useState<Choice>(choice)
  if (started) {
    return (
      <span className="proto-location">
        <PerRepository choice={choice} fixed />
      </span>
    )
  }
  const pick = (next: Choice) => {
    onChoose(next)
    popup.close()
  }
  const row = (next: Choice, rest: Omit<Row, "act" | "checked" | "key">): Row => ({
    key: next.kind === "new" ? "new" : next.path,
    checked: sameChoice(choice, next),
    act: () => pick(next),
    ...rest,
  })
  const rows: Row[] = [
    row(NEW, { icon: "plus", label: "New worktrees" }),
    ...WORKING_FOLDERS.map((folder, i) =>
      row(
        { kind: "existing", path: folder.path },
        {
          icon: "worktree",
          label: folder.branch ?? folderName(folder.path),
          mono: true,
          ...(i === 0 && { heading: "Existing worktrees" }),
        },
      ),
    ),
    ...FOLDERS.map((folder, i) =>
      row(
        { kind: "folder", path: folder.path },
        {
          icon: "folder",
          label: folder.name,
          ...(i === 0 && { heading: "One project folder" }),
        },
      ),
    ),
  ]
  const choiceOf = (key: string): Choice =>
    key === "new"
      ? NEW
      : WORKING_FOLDERS.some((w) => w.path === key)
        ? { kind: "existing", path: key }
        : { kind: "folder", path: key }
  return (
    <span className="proto-location">
      <span className="proto-anchor" ref={popup.anchor}>
        <Trigger
          ref={popup.trigger}
          choice={choice}
          open={popup.open}
          onClick={() => {
            setShown(choice)
            popup.setOpen(!popup.open)
          }}
        />
        {popup.open && (
          <div className="iv-composer-menu proto-popup proto-columns" aria-label="Working folder">
            <div className="proto-column">
              <div className="proto-caption">Working folder</div>
              <div className="iv-composer-menu__viewport">
                <List
                  rows={rows}
                  onClose={popup.close}
                  onHighlight={(highlighted) => setShown(choiceOf(highlighted.key))}
                />
              </div>
            </div>
            <div className="proto-column proto-column--detail">
              <div className="proto-caption">What the agent gets</div>
              <div className="proto-outcomes">
                {outcomes(shown).map((outcome) => (
                  <div
                    key={outcome.folder}
                    className="proto-outcome"
                    data-starts={outcome.starts || undefined}
                  >
                    <Icon name={outcome.icon} size={14} />
                    <span className="proto-outcome__folder">{outcome.folder}</span>
                    <span className="proto-outcome__what">{outcome.what}</span>
                    {outcome.branch !== undefined && (
                      <span className="proto-mono proto-outcome__branch">{outcome.branch}</span>
                    )}
                  </div>
                ))}
                {shown.kind === "existing" && workingFolderOf(shown.path).usedBy !== undefined && (
                  <p className="proto-used">
                    Also the working folder of “{workingFolderOf(shown.path).usedBy}”.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </span>
      <PerRepository choice={choice} />
    </span>
  )
}

// The branch of each repository when they differ, else the one branch.
function PerRepository({ choice, fixed }: { choice: Choice; fixed?: boolean }) {
  const repositories = choice.kind === "existing" ? workingFolderOf(choice.path).repositories : []
  const differ = new Set(repositories.map((r) => r.branch)).size > 1
  return (
    <>
      {fixed && <Trigger choice={choice} static />}
      {differ ? (
        repositories.map((r) => (
          <span key={r.name} className="proto-branch">
            <Icon name="git-branch" size={12} />
            <span className="proto-repo">{r.name}</span>
            <span className="proto-mono">{r.branch}</span>
          </span>
        ))
      ) : (
        <Branch>{location(choice).branch}</Branch>
      )}
    </>
  )
}
