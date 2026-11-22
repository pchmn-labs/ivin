import type { SettingsFileProblem as Problem } from "@ivin/contracts/setting"
import { Button } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { useOpenSettingsFile } from "../hooks/use-open-settings-file.ts"
import { settingsProblemMessage } from "../rules/setting-message.ts"
import "./settings-file-problem.css"

export function SettingsFileProblem({ problem }: { problem: Problem }) {
  const file = useOpenSettingsFile()
  return (
    <div className="iv-settings-file-problem" role="alert">
      <span className="iv-settings-file-problem__icon">
        <Icon name="circle-alert" size={14} />
      </span>
      <div className="iv-settings-file-problem__body">
        <Text weight="medium">{settingsProblemMessage(problem)}</Text>
        <Text size="sm" tone="muted">
          Fix the file and this page updates as soon as it is valid. Until then ivin uses the
          settings below, the file's last valid ones.
        </Text>
        <div className="iv-settings-file-problem__actions">
          <Button size="sm" icon="brackets-curly" onClick={file.open}>
            Open settings.json
          </Button>
        </div>
        {file.failure !== null && <ErrorMessage message={file.failure} onRetry={file.open} />}
      </div>
    </div>
  )
}
