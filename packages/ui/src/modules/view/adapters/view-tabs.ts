// Frames mark themselves `data-view-frame` with their placement; a view's tab, or the dialog's title, `data-view-tab` with its key.

export const focusViewTab = (key: string) =>
  requestAnimationFrame(() =>
    [...document.querySelectorAll<HTMLElement>("[data-view-tab]")]
      .find((tab) => tab.dataset["viewTab"] === key)
      ?.focus(),
  )

// Without the focus in a view, the view on top: the dialog, then the sheet, then beside the chat.
const FALLBACK = ["dialog", "sheet", "subView"]

const frameInFocus = (): HTMLElement | undefined => {
  const frames = [...document.querySelectorAll<HTMLElement>("[data-view-frame]")]
  return (
    frames.find((frame) => frame.contains(document.activeElement)) ??
    FALLBACK.map((placement) =>
      frames.find((frame) => frame.dataset["viewFrame"] === placement),
    ).find((frame) => frame !== undefined)
  )
}

export const openMoveMenu = () => {
  const frame = frameInFocus()
  const opener =
    frame?.querySelector<HTMLElement>('[data-view-tab][aria-selected="true"]') ??
    frame?.querySelector<HTMLElement>("[data-view-tab]")
  if (opener == null || !opener.hasAttribute("data-movable")) return
  opener.focus()
  // The dialog's title is a menu button; a tab opens its menu on a right click.
  if (opener.getAttribute("aria-haspopup") === "menu") {
    opener.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    )
    return
  }
  const box = opener.getBoundingClientRect()
  opener.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: box.left,
      clientY: box.bottom,
    }),
  )
}
