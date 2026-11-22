export interface SettingChoice {
  readonly value: unknown
  // The version of the watched file when the user picked.
  readonly fileVersion: number
  readonly failure: string | null
}

export interface ShownSetting {
  readonly value: unknown
  readonly failure: string | null
}

export const shownSetting = (
  file: { readonly value: unknown; readonly version: number },
  choice: SettingChoice | null,
): ShownSetting =>
  choice === null || file.version !== choice.fileVersion
    ? { value: file.value, failure: null }
    : { value: choice.value, failure: choice.failure }
