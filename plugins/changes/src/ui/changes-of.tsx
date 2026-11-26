import { useEffect, useMemo, useRef, useState } from "react"
import {
  ChangeList,
  Chips,
  EmptyMessage,
  ErrorMessage,
  Stack,
  useChanges,
  type ChangeKind,
  useDiffOnScreen,
  useDiscardChanges,
  useOpenDiff,
  type ActionFailure,
  type ChangeGroup,
  type Change,
  type ChangeListRow,
  type CommittedChangeListing,
  type DiscardFailure,
  type Session,
} from "@ivin/plugin-api/ui"
import { changeItems } from "../rules/change-items.ts"
import type { Discarding } from "../rules/discarding.ts"
import { AREA, COMMITTED, UNCOMMITTED } from "../rules/groups.ts"
import { listError } from "../rules/list-error.ts"
import { FOLDER_DELETED, emptyMessages } from "../rules/messages.ts"
import type { OnScreen } from "../rules/on-screen.ts"
import { ALL, inRepository, repositoryChips } from "../rules/repository-filter.ts"
import { DiscardDialog } from "./discard-dialog.tsx"
import { ListingFailure } from "./listing-failure.tsx"

interface OpenFailure extends ActionFailure {
  readonly retry: () => void
}

const filtered = (
  listing: CommittedChangeListing,
  changes: ReadonlyArray<Change>,
): CommittedChangeListing => (listing.kind === "listed" ? { ...listing, changes } : listing)

export function ChangesOf({ session, onScreen }: { session: Session; onScreen: OnScreen }) {
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
  const [pickedRepository, setPickedRepository] = useState("")
  const allChanges = useMemo(() => (listing.kind === "listed" ? listing.changes : []), [listing])
  const listed = committed.listing.kind === "listed" ? committed.listing : null
  const repositories = listing.kind === "listed" ? listing.repositories : undefined
  const { chips, picked } = repositoryChips(
    repositories ?? [],
    [...allChanges, ...(listed?.changes ?? [])],
    pickedRepository,
  )
  const changes = useMemo(() => inRepository(allChanges, picked), [allChanges, picked])
  const committedChanges = useMemo(
    () => inRepository(listed?.changes ?? [], picked),
    [listed, picked],
  )

  const askOne = (path: string) => {
    const change = changes.find((candidate) => candidate.path === path)
    if (change !== undefined) setDiscarding({ all: false, changes: [change] })
  }
  const askAll = () => {
    if (changes.length > 0) setDiscarding({ all: true, changes })
  }
  useEffect(() => {
    onScreen.current = {
      discardFocused: () => {
        const row = focusedRow.current
        if (row?.groupId === UNCOMMITTED) askOne(row.id)
      },
      discardAll: askAll,
    }
    return () => {
      onScreen.current = null
    }
  })

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
            discardCommand: "changes.discard",
            discardAll: {
              label:
                picked === ALL
                  ? "Discard all uncommitted changes"
                  : `Discard all uncommitted changes in ${picked}`,
              onDiscard: askAll,
              command: "changes.discardAll",
            },
            ...(discardAllFailure !== null && { error: listError(discardAllFailure) }),
          },
        ]
      : []),
    ...(listed !== null && committedChanges.length > 0
      ? [
          {
            id: COMMITTED,
            heading: "Committed",
            label: "Committed changes",
            title: `Since the branch left ${listed.base}`,
            items: changeItems(committedChanges),
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
      return <EmptyMessage>{FOLDER_DELETED}</EmptyMessage>
    case "not_repository":
      return (
        <EmptyMessage>
          This working folder is not in a git repository, so it has no changes to show.
        </EmptyMessage>
      )
    case "failed":
      return <ListingFailure listing={listing} retry={retry} />
    case "listed": {
      const empty = emptyMessages(changes.length, filtered(committed.listing, committedChanges))
      return (
        <Stack direction="column" gap={3}>
          {openFailure !== null && (
            <ErrorMessage
              message={openFailure.text}
              {...(openFailure.retryable && { onRetry: openFailure.retry })}
            />
          )}
          {chips.length > 0 && (
            <Chips
              label="Repository"
              options={chips}
              value={picked}
              onChange={setPickedRepository}
            />
          )}
          {empty.uncommitted !== null && <EmptyMessage>{empty.uncommitted}</EmptyMessage>}
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
          {empty.committed !== null && <EmptyMessage>{empty.committed}</EmptyMessage>}
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
