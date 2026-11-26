import { useState } from "react"
import {
  ErrorMessage,
  IconButton,
  ListRow,
  Pill,
  RelativeTime,
  Stack,
  StatusTile,
  Text,
  useRemoveAnnotation,
  type ActionFailure,
} from "@ivin/plugin-api/ui"
import { fallbackTitle, parsePrUrl, pillsOf, repoName, tileOf, type Pr } from "../rules/prs.ts"

function Subtitle({ pr }: { pr: Pr }) {
  const parsed = parsePrUrl(pr.url)
  const at = pr.activityAt === undefined ? Number.NaN : Date.parse(pr.activityAt)
  return (
    <Text size="xs" tone="faint" truncate>
      {parsed !== undefined && (
        <Text size="xs" mono>{`${repoName(parsed.repo)} #${parsed.number}`}</Text>
      )}
      {parsed !== undefined && !Number.isNaN(at) && " · "}
      {!Number.isNaN(at) && <RelativeTime at={{ epochMilliseconds: at }} />}
    </Text>
  )
}

export function PrRow({ pr }: { pr: Pr }) {
  const removeAnnotation = useRemoveAnnotation()
  const [failure, setFailure] = useState<ActionFailure | undefined>()
  const pills = pillsOf(pr)

  const remove = async () => {
    setFailure(undefined)
    for (const id of pr.annotationIds) {
      const failed = await removeAnnotation(id)
      if (failed !== undefined) {
        setFailure(failed)
        return
      }
    }
  }

  const { mark, ...tile } = tileOf([pr])
  return (
    <ListRow
      href={pr.url}
      leading={<StatusTile {...tile} {...(mark !== undefined && { mark })} />}
      title={<Text weight="medium">{pr.title ?? fallbackTitle(pr.url)}</Text>}
      subtitle={<Subtitle pr={pr} />}
      actions={
        <IconButton
          icon="x"
          label="Remove from this session"
          size="sm"
          onClick={() => void remove()}
        />
      }
      {...((pills.length > 0 || failure !== undefined) && {
        below: (
          <Stack gap={1}>
            {pills.length > 0 && (
              <Stack direction="row" gap={1} wrap>
                {pills.map((pill) => (
                  <Pill
                    key={pill.text}
                    tone={pill.tone}
                    {...(pill.icon !== undefined && { icon: pill.icon })}
                    {...(pill.status !== undefined && { status: pill.status })}
                  >
                    {pill.text}
                  </Pill>
                ))}
              </Stack>
            )}
            {failure !== undefined && (
              <ErrorMessage
                message={failure.text}
                {...(failure.retryable && { onRetry: () => void remove() })}
              />
            )}
          </Stack>
        ),
      })}
    />
  )
}
