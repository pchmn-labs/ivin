// The panel on screen, for the commands, which run outside React.
export interface OnScreen {
  current: { readonly discardFocused: () => void; readonly discardAll: () => void } | null
}
