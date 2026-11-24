import { useChanges, type Session } from "@ivin/plugin-api/ui"

export function ChangeCount({ session }: { session: Session }) {
  const uncommitted = useChanges(session.id, "working").listing
  const committed = useChanges(session.id, "committed").listing
  // A file changed in a commit and again since counts once.
  const paths = new Set(
    [uncommitted, committed].flatMap((listing) =>
      listing.kind === "listed" ? listing.changes.map((change) => change.path) : [],
    ),
  )
  return paths.size > 0 ? paths.size : null
}
