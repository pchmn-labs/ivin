import type { PluginFileChange } from "@ivin/contracts/plugin"
import { Text } from "../../../core/components/text/text.tsx"
import type { PermissionWords } from "../rules/permission-words.ts"
import { diffLines } from "../rules/project-plugin-queue.ts"
import "./plugin-review.css"

export function PluginReview({
  heading,
  files,
  diff,
  permissions,
}: {
  heading: string
  files: ReadonlyArray<PluginFileChange>
  diff: string
  // Absent for a change already run, which no longer asks for trust.
  permissions?: PermissionWords
}) {
  const lines = diffLines(diff)
  return (
    <div className="iv-plugin-review">
      <section className="iv-plugin-review__section">
        <Text size="xs" tone="faint" weight="medium">
          {heading}
        </Text>
        <ul className="iv-plugin-review__files">
          {files.map((file) => (
            <li key={file.path}>
              <span className="iv-plugin-review__status" data-status={file.status}>
                {file.status}
              </span>
              {file.path}
            </li>
          ))}
        </ul>
      </section>
      {lines.length > 0 && (
        // Focusable so the keyboard can scroll a long diff.
        <pre className="iv-plugin-review__diff" tabIndex={0} aria-label="Changes">
          {lines.map((line, index) => (
            <span key={index} className="iv-plugin-review__line" data-kind={line.kind}>
              {line.text}
            </span>
          ))}
        </pre>
      )}
      {permissions !== undefined && (
        <section className="iv-plugin-review__section">
          <Text size="xs" tone="faint" weight="medium">
            What it can do
          </Text>
          <Text size="xs" tone="muted">
            {permissions.reach}
          </Text>
          {permissions.declared.length === 0 ? (
            <Text size="xs" tone="muted">
              Declares no permission
            </Text>
          ) : (
            <ul className="iv-plugin-review__permissions">
              {permissions.declared.map((line) => (
                <li key={line}>
                  <Text size="xs" tone="muted">
                    {line}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
