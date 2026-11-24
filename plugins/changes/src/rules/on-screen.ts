export interface OnScreen {
  current: { readonly discardFocused: () => void; readonly discardAll: () => void } | null
}
