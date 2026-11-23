# usage

Shows the session's total tokens and cost in the `composer.status` slot (contribution `usage/status`). The total comes from the server (`useUsage`, over `transcript.watchUsage`): the sum over every `usage` item of the session, not of the items the window has loaded, and the slot renders nothing until there is one. Its format is in `src/rules/total-usage.ts`.
