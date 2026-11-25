import { defaultSettings } from "@ivin/contracts/setting"
import { AsyncResult } from "effect/reactivity"
import { expect, test, vi } from "vitest"
import { makeTestRegistry } from "../../../core/test-registry.ts"
import { setSettingOf, shownSettingOf } from "./set-setting.ts"
import { watchedSettingsAtom } from "./settings.ts"

const PATH = "tabs.stopAgentOnClose"

const setup = async () => {
  const { registry, server } = makeTestRegistry()
  registry.mount(watchedSettingsAtom)
  registry.mount(shownSettingOf(PATH))
  registry.mount(setSettingOf(PATH))
  await vi.waitFor(() =>
    expect(AsyncResult.isSuccess(registry.get(watchedSettingsAtom))).toBe(true),
  )
  return { registry, server }
}

test("a change is written to the file, and the file's new value shows", async () => {
  const { registry, server } = await setup()
  registry.set(setSettingOf(PATH), false)
  await vi.waitFor(() =>
    expect(registry.get(shownSettingOf(PATH))).toEqual({
      value: false,
      failure: null,
    }),
  )
  server.setUserSettings({
    settings: { ...defaultSettings, tabs: { ...defaultSettings.tabs, stopAgentOnClose: true } },
    problem: null,
  })
  await vi.waitFor(() => expect(registry.get(shownSettingOf(PATH)).value).toBe(true))
})

test("a failed write keeps the user's choice with a message, and a retry saves it", async () => {
  const { registry, server } = await setup()
  server.failNextCall("setting.set")
  registry.set(setSettingOf(PATH), false)
  await vi.waitFor(() =>
    expect(registry.get(shownSettingOf(PATH))).toEqual({
      value: false,
      failure: "The setting was not saved.",
    }),
  )
  registry.set(setSettingOf(PATH), false)
  await vi.waitFor(() =>
    expect(registry.get(shownSettingOf(PATH))).toEqual({
      value: false,
      failure: null,
    }),
  )
})
