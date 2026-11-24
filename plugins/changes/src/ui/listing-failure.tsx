import { CodeBlock, ErrorMessage, Stack, type ChangeListing } from "@ivin/plugin-api/ui"

export function ListingFailure({
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
