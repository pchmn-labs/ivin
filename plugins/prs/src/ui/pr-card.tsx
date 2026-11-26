import { ErrorMessage, ListSection, Stack, type Session } from "@ivin/plugin-api/ui"
import { usePrs } from "../hooks/use-prs.ts"
import { errorsOf } from "../rules/prs.ts"
import { PrRow } from "./pr-row.tsx"

export function PrCard({ session }: { session: Session }) {
  const prs = usePrs(session.id)
  if (prs.length === 0) return null
  return (
    <ListSection label={prs.length === 1 ? "Pull request" : `Pull requests · ${prs.length}`}>
      {prs.map((pr) => (
        <Stack as="li" key={pr.url}>
          <PrRow pr={pr} />
        </Stack>
      ))}
      {errorsOf(prs).map((message) => (
        <Stack as="li" key={message} padding={2}>
          <ErrorMessage message={message} />
        </Stack>
      ))}
    </ListSection>
  )
}
