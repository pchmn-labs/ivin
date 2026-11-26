import type { PluginFileChange } from "@ivin/contracts/plugin"
import { Text } from "../../../core/components/text/text.tsx"
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
  permissions?: ReadonlyArray<string>
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
            It declares
          </Text>
          {permissions.length === 0 ? (
            <Text size="xs" tone="muted">
              No permission.
            </Text>
          ) : (
            <ul className="iv-plugin-review__files">
              {permissions.map((permission) => (
                <li key={permission}>{permission}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
