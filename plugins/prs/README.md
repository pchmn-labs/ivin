# prs

Shows a session's pull requests from its `pr` annotations, whichever namespace wrote them, so it knows no forge. It contributes two slots:

- `session.badge` (`prs/badge`): a `StatusTile` for the lead pull request after the session's title on its sidebar row and its tab, and `+N` for the others.
- `session.card` (`prs/card`): a section of the hover card, one row per pull request with its checks, review and merge pills, a link to the forge and a button that removes the pull request from the session.

Annotations with the same `url` are one pull request: the status fields come from the one that has `state` (the forge plugin's), the rest from any (`ivin link`'s). `src/rules/prs.ts` holds every decision: grouping, which pull request leads (open, draft, merged, closed, then the latest activity), the tile's icon, tone, corner mark and pulse, and the pills. Both slots render nothing for a session with no `pr` annotation, which keeps the card closed. Removing a pull request removes every annotation of its URL, in any namespace, through `useRemoveAnnotation`.
