import { useAtom } from "@effect/atom-react"
import { Button } from "../../../core/components/button/button.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { startupNoticeAtom } from "../atoms/startup-notice.ts"
import { startupNoticeMessage } from "../rules/startup-notice.ts"
import "./startup-notice.css"

export function StartupNotice() {
  const [notice, setNotice] = useAtom(startupNoticeAtom)
  if (notice === null) return null
  return (
    <div className="iv-startup-notice" role="status">
      <Icon name="circle-info" size={14} />
      <Text size="sm" tone="muted">
        {startupNoticeMessage(notice)}
      </Text>
      <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
        Dismiss
      </Button>
    </div>
  )
}
