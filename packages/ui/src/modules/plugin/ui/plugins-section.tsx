import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { ProjectPlugin, ProjectPluginChange, ProjectPlugins } from "@ivin/contracts/plugin"
import { AsyncResult } from "effect/reactivity"
import { useState } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Disclosure } from "../../../core/components/disclosure/disclosure.tsx"
import { EmptyMessage } from "../../../core/components/empty-message/empty-message.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { LoadingRows } from "../../../core/components/loading-rows/loading-rows.tsx"
import { Switch } from "../../../core/components/switch/switch.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { useNow } from "../../../shared/use-now.ts"
import { relativeTime } from "../../session/rules/relative-time.ts"
import { markChangesSeenOf } from "../atoms/mark-changes-seen.ts"
import { projectPluginsAtom } from "../atoms/project-plugins.ts"
import { useSetFullTrust, useTrustProjectPlugin } from "../hooks/use-trust-project-plugin.ts"
import { FULL_TRUST_WARNING } from "../rules/full-trust-copy.ts"
import { unseenChanges } from "../rules/project-plugin-queue.ts"
import { PluginReview } from "./plugin-review.tsx"
import "./plugins-section.css"

function WaitingPlugin({ project, plugin }: { project: string; plugin: ProjectPlugin }) {
  const [reviewing, setReviewing] = useState(false)
  const own = useTrustProjectPlugin(project, plugin)
  const isNew = plugin.state === "new"
  return (
    <li className="iv-plugins-section__waiting">
      <div className="iv-plugins-section__line">
        <Text weight="medium">{plugin.name}</Text>
        <Text size="sm" tone="muted">
          {isNew ? "Not running" : "Running the version you trusted"}
        </Text>
        <span className="iv-plugins-section__buttons">
          <Button
            size="sm"
            variant="ghost"
            aria-label={`${reviewing ? "Hide" : "Review"} ${plugin.name}`}
            aria-expanded={reviewing}
            onClick={() => setReviewing(!reviewing)}
          >
            {reviewing ? "Hide" : "Review"}
          </Button>
          <Button
            size="sm"
            variant="primary"
            aria-label={`Trust this version of ${plugin.name}`}
            disabled={own.trusting}
            onClick={own.trust}
          >
            Trust this version
          </Button>
        </span>
      </div>
      {plugin.permissionsChanged && (
        <Text size="xs" tone="faint">
          Its declared permissions changed, so full trust does not cover it.
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
    </li>
  )
}

function RecentChange({ change }: { change: ProjectPluginChange }) {
  const now = useNow()
  const elapsed = relativeTime(change.at, now)
  return (
    <li>
      <Disclosure
        summary={
          <span className="iv-plugins-section__line">
            {!change.seen && (
              <span className="iv-plugins-section__unread" role="img" aria-label="Unread" />
            )}
            <Text weight="medium">{change.name}</Text>
            <Text size="sm" tone="muted">
              {change.isNew ? "Added, running" : "Updated, running"}
            </Text>
            <Text size="xs" tone="faint">
              {elapsed === "now" ? elapsed : `${elapsed} ago`}
            </Text>
          </span>
        }
      >
        <PluginReview
          heading={change.isNew ? "Files added" : "What changed"}
          files={change.files}
          diff={change.diff}
        />
      </Disclosure>
    </li>
  )
}

function RecentChanges({ state }: { state: ProjectPlugins }) {
  const result = useAtomValue(markChangesSeenOf(state.project))
  const markSeen = useAtomSet(markChangesSeenOf(state.project))
  const changes = [...state.changes].sort((a, b) => b.at - a.at)
  return (
    <div className="iv-plugins-section__group">
      <Text size="xs" tone="faint" weight="medium">
        Recent changes
      </Text>
      {changes.length === 0 ? (
        <EmptyMessage>No plugin of this project changed since you turned this on.</EmptyMessage>
      ) : (
        <ul className="iv-plugins-section__rows">
          {changes.map((change) => (
            <RecentChange key={`${change.id}\0${change.hash}`} change={change} />
          ))}
        </ul>
      )}
      {unseenChanges(state).length > 0 && (
        <div>
          <Button size="sm" disabled={result.waiting} onClick={() => markSeen()}>
            Mark as read
          </Button>
        </div>
      )}
      {AsyncResult.isFailure(result) && (
        <ErrorMessage
          message="ivin could not mark these changes as read."
          onRetry={() => markSeen()}
        />
      )}
    </div>
  )
}

function ProjectPluginsRow({ state }: { state: ProjectPlugins }) {
  const full = useSetFullTrust(state.project)
  const waiting = state.plugins.filter((plugin) => plugin.state !== "trusted")
  const descriptionId = `trust-all-${state.project}`
  return (
    <li className="iv-settings-page__setting iv-plugins-section__project">
      <div className="iv-plugins-section__head">
        <div className="iv-settings-page__setting-text">
          <Text weight="medium">{state.projectName}</Text>
          <Text size="sm">Trust all changes to this project's plugins</Text>
          <div id={descriptionId}>
            <Text size="xs" tone="faint">
              {FULL_TRUST_WARNING}
            </Text>
          </div>
          {full.failure !== null && (
            <ErrorMessage message={full.failure} onRetry={() => full.set(!state.fullTrust)} />
          )}
        </div>
        <Switch
          label={`Trust all changes to the plugins of ${state.projectName}`}
          checked={state.fullTrust}
          disabled={full.setting}
          onChange={full.set}
          aria-describedby={descriptionId}
        />
      </div>
      {waiting.length > 0 && (
        <div className="iv-plugins-section__group">
          <Text size="xs" tone="faint" weight="medium">
            Waiting for your trust
          </Text>
          <ul className="iv-plugins-section__rows">
            {waiting.map((plugin) => (
              <WaitingPlugin key={plugin.id} project={state.project} plugin={plugin} />
            ))}
          </ul>
        </div>
      )}
      {state.fullTrust ? (
        <RecentChanges state={state} />
      ) : (
        waiting.length === 0 && (
          <Text size="sm" tone="muted">
            Every plugin of this project is trusted at its current version.
          </Text>
        )
      )}
    </li>
  )
}

export function PluginsSection() {
  const result = useAtomValue(projectPluginsAtom)
  const refresh = useAtomRefresh(projectPluginsAtom)
  if (AsyncResult.isFailure(result)) {
    return (
      <li className="iv-settings-page__setting">
        <ErrorMessage
          message="ivin could not read the plugins of your projects."
          onRetry={refresh}
        />
      </li>
    )
  }
  if (!AsyncResult.isSuccess(result)) {
    return (
      <li className="iv-settings-page__setting">
        <LoadingRows label="Loading plugins" />
      </li>
    )
  }
  const projects = result.value.filter((state) => state.plugins.length > 0)
  if (projects.length === 0) {
    return (
      <li className="iv-settings-page__setting">
        <EmptyMessage>
          No project you trust ships a plugin. A plugin goes in a project's .ivin/plugins folder,
          and ivin asks here before it runs.
        </EmptyMessage>
      </li>
    )
  }
  return projects.map((state) => <ProjectPluginsRow key={state.project} state={state} />)
}
