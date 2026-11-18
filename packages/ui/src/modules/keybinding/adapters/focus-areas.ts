export const AREA_ATTRIBUTE = "data-keybinding-area"

// The keybinding areas holding the focus, closest first.
export const focusAreas = (): ReadonlyArray<string> => {
  const areas: Array<string> = []
  for (let node = document.activeElement; node !== null; node = node.parentElement) {
    const area = node.getAttribute(AREA_ATTRIBUTE)
    if (area !== null) areas.push(area)
  }
  return areas
}
