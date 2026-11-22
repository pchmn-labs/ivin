// The value the user picked on the page, until the watched file changes.
export interface SettingChoice {
  readonly value: unknown
  // The version of the watched file when the user picked.
  readonly fileVersion: number
  readonly state: "saving" | "saved" | "failed"
  readonly failure: string | null
}

export interface ShownSetting {
  readonly value: unknown
  readonly saving: boolean
  readonly failure: string | null
}

export const shownSetting = (
  file: { readonly value: unknown; readonly version: number },
  choice: SettingChoice | null,
): ShownSetting =>
  choice === null || file.version !== choice.fileVersion
    ? { value: file.value, saving: false, failure: null }
    : { value: choice.value, saving: choice.state === "saving", failure: choice.failure }
