import { ErrorMessage, type ActionFailure } from "@ivin/plugin-api/ui"

export function OpenFailure({
  failure,
  open,
}: {
  failure: ({ path: string } & ActionFailure) | null
  open: (path: string) => Promise<void>
}) {
  if (failure === null) return null
  return (
    <ErrorMessage
      message={failure.text}
      {...(failure.retryable && { onRetry: () => void open(failure.path) })}
    />
  )
}
