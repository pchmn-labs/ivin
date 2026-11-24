import { useEffect, useMemo, useRef, useState } from "react"
import {
  Button,
  ChangeList,
  CodeBlock,
  Dialog,
  ErrorMessage,
  Stack,
  Text,
  defineUi,
  useChanges,
  type ChangeKind,
  useDiffOnScreen,
  useDiscardChanges,
  useOpenDiff,
  useSelectedSessionId,
  useSession,
  type ActionFailure,
  type Change,
  type ChangeGroup,
  type ChangeListError,
  type ChangeListRow,
  type ChangeListing,
  type CommittedChangeListing,
  type DiscardFailure,
  type Session,
} from "@ivin/plugin-api/ui"
import { changeItems } from "./rules/change-items.ts"
import { discardAllText, discardText } from "./rules/discard-text.ts"

const UNCOMMITTED = "uncommitted"
const COMMITTED = "committed"
// The list's keybinding area, where `changes.discard` and `changes.discardAll` apply.
const AREA = "changes"

// The panel on screen, for the commands, which run outside React.
let onScreen: { readonly discardFocused: () => void; readonly discardAll: () => void } | null = null

function Message({ children }: { children: string }) {
  return (
    <Text size="sm" tone="faint">
      {children}
    </Text>
  )
}

const FOLDER_DELETED = "This session's working folder was deleted, so it has no changes to show."

interface OpenFailure extends ActionFailure {
  readonly retry: () => void
}

// The changes the dialog asks to discard, as they were when it opened.
interface Discarding {
  readonly all: boolean
  readonly changes: ReadonlyArray<Change>
}

const listError = (failure: DiscardFailure): ChangeListError => ({
  text: failure.text,
  detail: failure.gitMessage,
})

function ListingFailure({
  listing,
  retry,
}: {
  listing: Extract<ChangeListing, { kind: "failed" }>
  retry: () => void
}) {
  return (
    <Stack direction="column" gap={2}>
      <ErrorMessage
        message={listing.failure.text}
        {...(listing.failure.retryable && { onRetry: retry })}
      />
      {listing.gitMessage !== null && <CodeBlock text={listing.gitMessage} />}
    </Stack>
  )
}

function DiscardDialog({
  discarding,
  onCancel,
  onConfirm,
}: {
  discarding: Discarding | null
  onCancel: () => void
  onConfirm: (discarding: Discarding) => void
}) {
  // The dialog keeps its text while it fades out.
  const shown = useRef(discarding)
  if (discarding !== null) shown.current = discarding
  const last = shown.current
  const text =
    last === null
      ? null
      : last.all
        ? discardAllText(last.changes)
        : discardText(last.changes[0] as Change)
  return (
    <Dialog
      open={discarding !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
      title={text?.title ?? ""}
      description={text?.description ?? ""}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => discarding !== null && onConfirm(discarding)}>
            {text?.action}
          </Button>
        </>
      }
    >
      <Text size="xs" tone="faint" mono preWrap>
        {(last?.changes ?? []).map((change) => change.path).join("\n")}
      </Text>
    </Dialog>
  )
}

const committedMessage = (listing: CommittedChangeListing): string | null => {
  switch (listing.kind) {
    case "no_origin":
      return "This repository has no origin remote, so the branch's commits cannot be listed."
    case "no_default_branch":
      return "Git does not know origin's default branch, so the branch's commits cannot be listed. Run git remote set-head origin --auto."
    case "no_merge_base":
      return "The branch shares no commit with origin's default branch, so its commits cannot be listed."
    case "listed":
      return listing.changes.length === 0 ? `No committed changes since ${listing.base}.` : null
    default:
      return null
  }
}

function ChangesOf({ session }: { session: Session }) {
  const { listing, retry } = useChanges(session.id, "working")
  const committed = useChanges(session.id, "committed")
  const openDiff = useOpenDiff()
  const discard = useDiscardChanges()
  const diffOnScreen = useDiffOnScreen(session.id)
  const [openFailure, setOpenFailure] = useState<OpenFailure | null>(null)
  const [discarding, setDiscarding] = useState<Discarding | null>(null)
  const [discardFailures, setDiscardFailures] = useState<ReadonlyMap<string, DiscardFailure>>(
    new Map(),
  )
  const [discardAllFailure, setDiscardAllFailure] = useState<DiscardFailure | null>(null)
  const focusedRow = useRef<ChangeListRow | null>(null)
  const changes = useMemo(() => (listing.kind === "listed" ? listing.changes : []), [listing])

  const askOne = (path: string) => {
    const change = changes.find((candidate) => candidate.path === path)
    if (change !== undefined) setDiscarding({ all: false, changes: [change] })
  }
  const askAll = () => {
    if (changes.length > 0) setDiscarding({ all: true, changes })
  }
  useEffect(() => {
    onScreen = {
      discardFocused: () => {
        const row = focusedRow.current
        if (row?.groupId === UNCOMMITTED) askOne(row.id)
      },
      discardAll: askAll,
    }
    return () => {
      onScreen = null
    }
  })

  const listed = committed.listing.kind === "listed" ? committed.listing : null
  const groups: ReadonlyArray<ChangeGroup> = [
    ...(changes.length > 0
      ? [
          {
            id: UNCOMMITTED,
            heading: "Uncommitted",
            label: "Uncommitted changes",
            items: changeItems(changes).map((item) => {
              const failure = discardFailures.get(item.id)
              return failure === undefined ? item : { ...item, error: listError(failure) }
            }),
            onDiscard: askOne,
            discardAll: { label: "Discard all uncommitted changes", onDiscard: askAll },
            ...(discardAllFailure !== null && { error: listError(discardAllFailure) }),
          },
        ]
      : []),
    ...(listed !== null && listed.changes.length > 0
      ? [
          {
            id: COMMITTED,
            heading: "Committed",
            label: "Committed changes",
            title: `Since the branch left ${listed.base}`,
            items: changeItems(listed.changes),
          },
        ]
      : []),
  ]

  const run = async (path: string, kind: ChangeKind) => {
    setOpenFailure(null)
    const failure = await openDiff(session.id, path, kind)
    if (failure !== undefined) setOpenFailure({ ...failure, retry: () => void run(path, kind) })
  }
  const confirm = async (target: Discarding) => {
    setDiscarding(null)
    const paths = target.changes.map((change) => change.path)
    if (target.all) setDiscardAllFailure(null)
    const failure = await discard(session.id, paths)
    if (target.all) return setDiscardAllFailure(failure ?? null)
    setDiscardFailures((failures) => {
      const next = new Map(failures)
      for (const path of paths) {
        if (failure === undefined) next.delete(path)
        else next.set(path, failure)
      }
      return next
    })
  }

  switch (listing.kind) {
    case "loading":
      return null
    case "deleted":
      return <Message>{FOLDER_DELETED}</Message>
    case "not_repository":
      return (
        <Message>
          This working folder is not in a git repository, so it has no changes to show.
        </Message>
      )
    case "failed":
      return <ListingFailure listing={listing} retry={retry} />
    case "listed": {
      const below = committedMessage(committed.listing)
      return (
        <Stack direction="column" gap={3}>
          {openFailure !== null && (
            <ErrorMessage
              message={openFailure.text}
              {...(openFailure.retryable && { onRetry: openFailure.retry })}
            />
          )}
          {changes.length === 0 && (
            <Message>No uncommitted changes. What the agent changes shows up here.</Message>
          )}
          {groups.length > 0 && (
            <ChangeList
              label="Changes"
              area={AREA}
              groups={groups}
              selected={
                diffOnScreen !== null
                  ? {
                      groupId: diffOnScreen.kind === "committed" ? COMMITTED : UNCOMMITTED,
                      id: diffOnScreen.path,
                    }
                  : null
              }
              onOpen={(row) =>
                void run(row.id, row.groupId === COMMITTED ? "committed" : "working")
              }
              onFocusRow={(row) => {
                focusedRow.current = row
              }}
            />
          )}
          {below !== null && <Message>{below}</Message>}
          {committed.listing.kind === "failed" && (
            <ListingFailure listing={committed.listing} retry={committed.retry} />
          )}
          <DiscardDialog
            discarding={discarding}
            onCancel={() => setDiscarding(null)}
            onConfirm={(target) => void confirm(target)}
          />
        </Stack>
      )
    }
  }
}

function ChangesPanel() {
  const sessionId = useSelectedSessionId()
  const session = useSession(sessionId ?? "")
  if (sessionId === null)
    return <Message>No session on screen. Open one to see its changes.</Message>
  if (session === undefined) return null
  if (session.workingFolderDeleted) return <Message>{FOLDER_DELETED}</Message>
  return <ChangesOf key={`${session.id}\n${session.workingFolder}`} session={session} />
}

function ChangeCount({ session }: { session: Session }) {
  const { listing } = useChanges(session.id, "working")
  const committed = useChanges(session.id, "committed").listing
  const uncommitted = listing.kind === "listed" ? listing.changes.length : 0
  const committedCount = committed.kind === "listed" ? committed.changes.length : 0
  if (committedCount > 0) return `${uncommitted} · ${committedCount}`
  return uncommitted > 0 ? uncommitted : null
}

function ChangesBadge() {
  const session = useSession(useSelectedSessionId() ?? "")
  return session === undefined || session.workingFolderDeleted ? null : (
    <ChangeCount session={session} />
  )
}

export const activate = defineUi((ctx) => {
  ctx.slots.add("sidebar.panel", ChangesPanel, {
    name: "panel",
    title: "Changes",
    badge: ChangesBadge,
  })
  ctx.commands.register("changes.show", {
    title: "Show changes",
    run: () => ctx.sidebar.showPanel("panel"),
  })
  ctx.commands.register("changes.discard", {
    title: "Discard the focused change",
    run: () => onScreen?.discardFocused(),
  })
  ctx.commands.register("changes.discardAll", {
    title: "Discard all uncommitted changes",
    run: () => onScreen?.discardAll(),
  })
  ctx.keybindings.add({ key: "mod+3", command: "changes.show" })
  ctx.keybindings.add({ key: "backspace", command: "changes.discard", when: AREA })
  ctx.keybindings.add({ key: "mod+backspace", command: "changes.discardAll", when: AREA })
})
