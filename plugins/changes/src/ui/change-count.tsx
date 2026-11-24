import { useChanges, type Session } from "@ivin/plugin-api/ui"

export function ChangeCount({ session }: { session: Session }) {
  const { listing } = useChanges(session.id, "working")
  const committed = useChanges(session.id, "committed").listing
  const uncommitted = listing.kind === "listed" ? listing.changes.length : 0
  const committedCount = committed.kind === "listed" ? committed.changes.length : 0
  if (committedCount > 0) return `${uncommitted} · ${committedCount}`
  return uncommitted > 0 ? uncommitted : null
}
