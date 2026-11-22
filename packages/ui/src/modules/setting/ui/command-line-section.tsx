import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useId } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Icon } from "../../../core/components/icon/icon.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { getShellInstallAtom } from "../../cli/atoms/get-shell-install.ts"
import { installInShellAtom, shellInstallStateAtom } from "../../cli/atoms/install-in-shell.ts"
import { CHECK_FAILURE, pathHint } from "../../cli/rules/shell-install-message.ts"

function InstallState() {
  const state = useAtomValue(shellInstallStateAtom)
  const refresh = useAtomRefresh(getShellInstallAtom)
  if (state.installing) {
    return (
      <Text size="sm" tone="muted">
        Installing…
      </Text>
    )
  }
  if (state.install !== null) {
    const hint = pathHint(state.install)
    return (
      <>
        <span className="iv-settings-page__state">
          <Icon name="check" size={14} />
          <Text size="sm" tone="muted">
            Installed at{" "}
            <Text size="sm" mono>
              {state.install.path}
            </Text>
          </Text>
        </span>
        {hint !== null && <Text size="sm">{hint}</Text>}
      </>
    )
  }
  if (state.checkFailed) {
    return <ErrorMessage message={CHECK_FAILURE} onRetry={refresh} />
  }
  if (state.checking) return null
  return (
    <Text size="sm" tone="muted">
      Not installed. Your agents can run it; your shell cannot.
    </Text>
  )
}

export function CommandLineSection() {
  const state = useAtomValue(shellInstallStateAtom)
  const install = useAtomSet(installInShellAtom)
  const descriptionId = useId()
  const installed = state.install !== null
  return (
    <li className="iv-settings-page__setting">
      <div className="iv-settings-page__setting-text">
        <Text weight="medium">
          <Text mono weight="medium">
            ivin
          </Text>{" "}
          in your shell
        </Text>
        <div id={descriptionId}>
          <Text size="sm" tone="muted">
            Adds a link to ivin's command so a new terminal runs{" "}
            <Text size="sm" mono>
              ivin doctor
            </Text>{" "}
            or{" "}
            <Text size="sm" mono>
              ivin settings
            </Text>
            .
          </Text>
        </div>
        <InstallState />
        {state.failure !== null && (
          <ErrorMessage message={state.failure} onRetry={() => install()} />
        )}
      </div>
      <Button
        variant={installed ? "ghost" : "secondary"}
        disabled={state.installing || state.checking}
        onClick={() => install()}
        aria-describedby={descriptionId}
      >
        {installed ? "Reinstall" : "Install"}
      </Button>
    </li>
  )
}
