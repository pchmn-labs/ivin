import { useAtomSet, useAtomValue } from "@effect/atom-react"
import type { ProjectPlugin, ProjectPluginChange, ProjectPlugins } from "@ivin/contracts/plugin"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import { ActionSheet } from "../../../core/components/action-sheet/action-sheet.tsx"
import { Button } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { selectedProjectAtom } from "../../project/atoms/selected-project.ts"
import { markChangesSeenOf } from "../atoms/mark-changes-seen.ts"
import { projectPluginsAtom } from "../atoms/project-plugins.ts"
import {
  FULL_TRUST_WARNING,
  useSetFullTrust,
  useTrustProjectPlugin,
} from "../hooks/use-trust-project-plugin.ts"
import { unseenChanges, waitingPlugins } from "../rules/project-plugin-queue.ts"
import { PluginReview } from "./plugin-review.tsx"
import "./project-plugin-sheets.css"

function TrustSheet({
  state,
  plugin,
  moreWaiting,
}: {
  state: ProjectPlugins
  plugin: ProjectPlugin
  moreWaiting: number
}) {
  const [reviewing, setReviewing] = useState(false)
  const own = useTrustProjectPlugin(state.project, plugin)
  const full = useSetFullTrust(state.project)
  const isNew = plugin.state === "new"
  const offersFullTrust = !state.fullTrust && !plugin.permissionsChanged
  const busy = own.trusting || full.setting
  return (
    <ActionSheet
      tone="attention"
      icon="triangle-alert"
      title={
        isNew
          ? `Run “${plugin.name}” from this project?`
          : `“${plugin.name}” changed in this project`
      }
      {...(moreWaiting > 0 && {
        aside: (
          <Text size="xs" tone="faint">
            {moreWaiting} more waiting
          </Text>
        ),
      })}
      {...(offersFullTrust && { hint: `“Trust all changes”: ${FULL_TRUST_WARNING}` })}
      actions={
        <>
          <Button
            variant="ghost"
            aria-expanded={reviewing}
            onClick={() => setReviewing(!reviewing)}
          >
            {reviewing ? "Hide" : "Review"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={own.trust}>
            Trust this version
          </Button>
          {offersFullTrust && (
            <Button variant="primary" disabled={busy} onClick={() => full.set(true)}>
              Trust all changes
            </Button>
          )}
        </>
      }
    >
      <div className="iv-project-plugin-sheet__body">
        <Text size="sm" tone="muted">
          {isNew
            ? "This project ships a plugin. It runs code in ivin, outside the agent's approvals."
            : "It runs code in ivin, outside the agent's approvals. Until you trust the new version, ivin keeps running the one you trusted before."}
        </Text>
        {plugin.permissionsChanged && (
          <Text size="sm" tone="muted">
            Its declared permissions changed, so full trust does not cover it: only you can trust
            this version.
          </Text>
        )}
        {reviewing && (
          <PluginReview
            heading={isNew ? "Files it would run" : "What changed since you trusted it"}
            files={plugin.files}
            diff={plugin.diff}
            permissions={plugin.permissions}
          />
        )}
        {own.failure !== null && <ErrorMessage message={own.failure} onRetry={own.trust} />}
        {full.failure !== null && (
          <ErrorMessage message={full.failure} onRetry={() => full.set(true)} />
        )}
      </div>
    </ActionSheet>
  )
}

const updatedTitle = (changes: ReadonlyArray<ProjectPluginChange>) =>
  changes.length === 1
    ? `“${changes[0]!.name}” was ${changes[0]!.isNew ? "added" : "updated"} and is running`
    : `${changes.length} plugins were updated and are running`

function ChangesSheet({
  project,
  changes,
}: {
  project: string
  changes: ReadonlyArray<ProjectPluginChange>
}) {
  const [open, setOpen] = useState(false)
  const result = useAtomValue(markChangesSeenOf(project))
  const markSeen = useAtomSet(markChangesSeenOf(project))
  return (
    <ActionSheet
      tone="neutral"
      icon="circle-info"
      title={updatedTitle(changes)}
      actions={
        <>
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide changes" : "See changes"}
          </Button>
          <Button variant="secondary" disabled={result.waiting} onClick={() => markSeen()}>
            Dismiss
          </Button>
        </>
      }
    >
      <div className="iv-project-plugin-sheet__body">
        <Text size="sm" tone="muted">
          Full trust is on for this project, so its changes run without a question.
        </Text>
        {open &&
          changes.map((change) => (
            <PluginReview
              key={`${change.id}\0${change.hash}`}
              heading={`${change.name}: ${change.isNew ? "files added" : "what changed"}`}
              files={change.files}
              diff={change.diff}
            />
          ))}
        {AsyncResult.isFailure(result) && (
          <ErrorMessage
            message="ivin could not mark these changes as read."
            onRetry={() => markSeen()}
          />
        )}
      </div>
    </ActionSheet>
  )
}

export function ProjectPluginSheets() {
  const project = useAtomValue(selectedProjectAtom)
  const result = useAtomValue(projectPluginsAtom)
  if (project === null || !AsyncResult.isSuccess(result)) return null
  const state = result.value.find(
    (candidate) => candidate.project === project.path || candidate.openAs.includes(project.path),
  )
  if (state === undefined) return null
  const waiting = waitingPlugins(result.value, project.path)
  const unseen = state.fullTrust ? unseenChanges(state) : []
  return (
    <>
      {waiting[0] !== undefined && (
        <TrustSheet
          key={waiting[0].id}
          state={state}
          plugin={waiting[0]}
          moreWaiting={waiting.length - 1}
        />
      )}
      {unseen.length > 0 && <ChangesSheet project={state.project} changes={unseen} />}
    </>
  )
}
