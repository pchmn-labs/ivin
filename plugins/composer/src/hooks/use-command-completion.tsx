import {
  ErrorMessage,
  Icon,
  Stack,
  Text,
  useAgentCommands,
  useProjects,
  useSession,
  type MessageFieldCompletion,
} from "@ivin/plugin-api/ui"
import { commandTag, rankCommands } from "../rules/agent-commands.ts"

// The `/` menu of the session's skills and commands; undefined for a harness that has none.
export function useCommandCompletion(sessionId: string): MessageFieldCompletion | undefined {
  const { listing, refresh } = useAgentCommands(sessionId)
  const session = useSession(sessionId)
  const { projects } = useProjects()
  if (listing.kind === "none") return undefined
  const projectPath = session?.projectPath ?? ""
  const projectName =
    projects.find((project) => project.path === projectPath)?.name ??
    projectPath.split("/").at(-1) ??
    ""
  return {
    trigger: "/",
    atStart: true,
    title: "Skills and commands",
    ...(listing.kind !== "loading" && { onOpen: refresh }),
    items: (query) =>
      listing.kind === "listed"
        ? rankCommands(listing.commands, query).map(({ command, match }) => ({
            id: command.name,
            label: command.name,
            match,
            ...(command.argumentHint !== null && { detail: command.argumentHint }),
            tag: commandTag(command, projectName),
            description: command.description,
          }))
        : [],
    ...(listing.kind === "loading" && {
      message: (
        <Stack direction="row" align="center" gap={2}>
          <Icon name="loader" size={14} />
          <Text size="sm" tone="muted">
            Loading skills and commands…
          </Text>
        </Stack>
      ),
    }),
    ...(listing.kind === "failed" && {
      message: (
        <ErrorMessage
          message={listing.failure.text}
          {...(listing.failure.retryable && { onRetry: refresh })}
        />
      ),
    }),
    empty: (query) => `No skill or command matches “/${query}”. Enter sends the message as typed.`,
  }
}
