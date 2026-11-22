import { useMemo, useState } from "react"
import {
  ChangeList,
  CodeBlock,
  ErrorMessage,
  Stack,
  Text,
  defineUi,
  useChanges,
  useDiffOnScreen,
  useOpenDiff,
  useOpenFile,
  useSelectedSessionId,
  useSession,
  type ActionFailure,
  type Session,
} from "@ivin/plugin-api/ui"
import { changeItems } from "./rules/change-items.ts"

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

function ChangesOf({ session }: { session: Session }) {
  const { listing, retry } = useChanges(session.id)
  const openDiff = useOpenDiff()
  const openFile = useOpenFile()
  const onScreen = useDiffOnScreen(session.id)
  const [openFailure, setOpenFailure] = useState<OpenFailure | null>(null)
  const items = useMemo(
    () => (listing.kind === "listed" ? changeItems(listing.changes) : []),
    [listing],
  )
  const run = async (open: typeof openDiff, path: string) => {
    setOpenFailure(null)
    const failure = await open(session.id, path)
    if (failure !== undefined) setOpenFailure({ ...failure, retry: () => void run(open, path) })
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
      return (
        <Stack direction="column" gap={2}>
          <ErrorMessage
            message={listing.failure.text}
            {...(listing.failure.retryable && { onRetry: retry })}
          />
          {listing.gitMessage !== null && <CodeBlock text={listing.gitMessage} />}
        </Stack>
      )
    case "listed":
      if (items.length === 0)
        return <Message>No uncommitted changes. What the agent changes shows up here.</Message>
      return (
        <Stack direction="column" gap={2}>
          {openFailure !== null && (
            <ErrorMessage
              message={openFailure.text}
              {...(openFailure.retryable && { onRetry: openFailure.retry })}
            />
          )}
          <ChangeList
            label="Uncommitted changes"
            items={items}
            selectedId={onScreen}
            onOpen={(path) => void run(openDiff, path)}
            onOpenFile={(path) => void run(openFile, path)}
          />
        </Stack>
      )
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
  return listing.kind === "listed" && listing.changes.length > 0 ? listing.changes.length : null
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
