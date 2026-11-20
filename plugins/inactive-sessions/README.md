# inactive-sessions

Lists the selected project's sessions that have no open tab, in the `sidebar.section` slot (contribution `inactive-sessions/section`), under a fold closed by default. Clicking a session opens its tab; its row's menu archives or deletes it, through the host's `useSessionActions`, and a failure shows under the row. The section is absent while every session has a tab. Which sessions are listed is in `rules/inactive-sessions.ts`.
