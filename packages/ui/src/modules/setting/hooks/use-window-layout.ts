import { useAtomValue } from "@effect/atom-react"
import { defaultSettings } from "@ivin/contracts/setting"
import { AsyncResult } from "effect/reactivity"
import { readStoredWindowLayout } from "../adapters/window-layout.ts"
import { watchedSettingsAtom } from "../atoms/settings.ts"

// Until the settings arrive, the layout of the last launch, so the window does not change shape.
export function useWindowLayout() {
  const result = useAtomValue(watchedSettingsAtom)
  if (AsyncResult.isSuccess(result)) return result.value.settings.window.layout
  return readStoredWindowLayout() ?? defaultSettings.window.layout
}
