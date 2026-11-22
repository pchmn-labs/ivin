import { useMemo, useRef, useState } from "react"
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
  useCommittedChanges,
  useCommittedDiffOnScreen,
  useDiffOnScreen,
  useDiscardAllChanges,
  useDiscardChange,
  useOpenCommittedDiff,
  useOpenDiff,
  useSelectedSessionId,
  useSession,
  type ActionFailure,
  type Change,
  type ChangeGroup,
  type ChangeListing,
  type CommittedChangeListing,
  type DiscardFailure,
  type Session,
} from "@ivin/plugin-api/ui"
import { changeItems } from "./rules/change-items.ts"
import { discardAllText, discardText } from "./rules/discard-text.ts"

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

// What the dialog asks to discard: one change, or all of them.
type Discarding = { readonly kind: "one"; readonly change: Change } | { readonly kind: "all" }

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
  changes,
  onCancel,
  onConfirm,
}: {
  discarding: Discarding | null
  changes: ReadonlyArray<Change>
  onCancel: () => void
  onConfirm: (discarding: Discarding) => void
}) {
  // The dialog keeps its text while it fades out.
  const shown = useRef({ discarding, changes })
  if (discarding !== null) shown.current = { discarding, changes }
  const last = shown.current.discarding
  const paths =
    last === null
      ? []
      : last.kind === "one"
        ? [last.change.path]
        : shown.current.changes.map((c) => c.path)
  const text =
    last === null
      ? null
      : last.kind === "one"
        ? discardText(last.change)
        : discardAllText(shown.current.changes)
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
        {paths.join("\n")}
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
      return listing.changes.length === 0
        ? `The branch has no commits since ${listing.base} yet.`
        : null
    default:
      return null
  }
}

function ChangesOf({ session }: { session: Session }) {
  const { listing, retry } = useChanges(session.id)
  const committed = useCommittedChanges(session.id)
  const openDiff = useOpenDiff()
  const openCommittedDiff = useOpenCommittedDiff()
  const discard = useDiscardChange()
  const discardAll = useDiscardAllChanges()
  const diffOnScreen = useDiffOnScreen(session.id)
  const committedOnScreen = useCommittedDiffOnScreen(session.id)
  const [openFailure, setOpenFailure] = useState<OpenFailure | null>(null)
  const [discarding, setDiscarding] = useState<Discarding | null>(null)
  const [discardFailures, setDiscardFailures] = useState<ReadonlyMap<string, DiscardFailure>>(
    new Map(),
  )
  const [discardAllFailure, setDiscardAllFailure] = useState<DiscardFailure | null>(null)
  const changes = listing.kind === "listed" ? listing.changes : []

  const groups = useMemo((): ReadonlyArray<ChangeGroup> => {
    const uncommitted: ChangeGroup = {
      id: "uncommitted",
      heading: "Uncommitted",
      label: "Uncommitted changes",
      items: changeItems(changes).map((item) => {
        const failure = discardFailures.get(item.id)
        return failure === undefined
          ? item
          : { ...item, error: { text: failure.text, detail: failure.gitMessage } }
      }),
      onDiscard: (path) =>
        setDiscarding({
          kind: "one",
          change: changes.find((change) => change.path === path) as Change,
        }),
      discardAll: {
        label: "Discard all uncommitted changes",
        onDiscard: () => setDiscarding({ kind: "all" }),
      },
      ...(discardAllFailure !== null && {
        error: { text: discardAllFailure.text, detail: discardAllFailure.gitMessage },
      }),
    }
    const listed = committed.listing.kind === "listed" ? committed.listing : null
    return [
      ...(changes.length > 0 ? [uncommitted] : []),
      ...(listed !== null && listed.changes.length > 0
        ? [
            {
              id: "committed",
              heading: "Committed",
              label: "Committed changes",
              title: `Since the branch left ${listed.base}`,
              items: changeItems(listed.changes),
            },
          ]
        : []),
    ]
  }, [changes, committed.listing, discardFailures, discardAllFailure])

  const run = async (
    open: (sessionId: string, path: string) => Promise<ActionFailure | undefined>,
    path: string,
  ) => {
    setOpenFailure(null)
    const failure = await open(session.id, path)
    if (failure !== undefined) setOpenFailure({ ...failure, retry: () => void run(open, path) })
  }
  const confirm = async (target: Discarding) => {
    setDiscarding(null)
    if (target.kind === "all") {
      setDiscardAllFailure(null)
      setDiscardFailures(new Map())
      setDiscardAllFailure((await discardAll(session.id)) ?? null)
      return
    }
    const path = target.change.path
    const failure = await discard(session.id, path)
    setDiscardFailures((failures) => {
      const next = new Map(failures)
      if (failure === undefined) next.delete(path)
      else next.set(path, failure)
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
              groups={groups}
              selected={
                diffOnScreen !== null
                  ? { groupId: "uncommitted", id: diffOnScreen }
                  : committedOnScreen !== null
                    ? { groupId: "committed", id: committedOnScreen }
                    : null
              }
              onOpen={(groupId, path) =>
                void run(groupId === "committed" ? openCommittedDiff : openDiff, path)
              }
            />
          )}
          {below !== null && <Message>{below}</Message>}
          {committed.listing.kind === "failed" && (
            <ListingFailure listing={committed.listing} retry={committed.retry} />
          )}
          <DiscardDialog
            discarding={discarding}
            changes={changes}
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
    return <Message>No session on screen. Open one to see its uncommitted changes.</Message>
  if (session === undefined) return null
  if (session.workingFolderDeleted) return <Message>{FOLDER_DELETED}</Message>
  return <ChangesOf key={`${session.id}\n${session.workingFolder}`} session={session} />
}

function ChangeCount({ session }: { session: Session }) {
  const { listing } = useChanges(session.id)
  const committed = useCommittedChanges(session.id).listing
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
  ctx.keybindings.add({ key: "mod+3", command: "changes.show" })
})
