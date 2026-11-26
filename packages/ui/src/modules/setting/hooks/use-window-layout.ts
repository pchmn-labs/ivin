import { useAtomValue } from "@effect/atom-react"
import { defaultSettings } from "@ivin/contracts/setting"
import { AsyncResult } from "effect/reactivity"
import { useEffect } from "react"
import {
  placeWindowButtons,
  readStoredWindowLayout,
  storeWindowLayout,
} from "../adapters/window-layout.ts"
import { watchedSettingsAtom } from "../atoms/settings.ts"

// Until the settings arrive, the layout of the last launch, so the window does not change shape.
export function useWindowLayout() {
  const result = useAtomValue(watchedSettingsAtom)
  if (AsyncResult.isSuccess(result)) return result.value.settings.window.layout
  return readStoredWindowLayout() ?? defaultSettings.window.layout
}

// Called once, by the window: moves the traffic lights and keeps the layout for the next launch.
export function useApplyWindowLayout() {
  const layout = useWindowLayout()
  useEffect(() => {
    placeWindowButtons(layout)
    storeWindowLayout(layout)
  }, [layout])
  return layout
}
