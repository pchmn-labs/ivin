export interface Platform {
  readonly mac: boolean
}

interface Chord {
  readonly ctrl: boolean
  readonly alt: boolean
  readonly shift: boolean
  readonly meta: boolean
  readonly key: string
}

export interface PressedKey {
  readonly key: string
  readonly code: string
  readonly metaKey: boolean
  readonly ctrlKey: boolean
  readonly altKey: boolean
  readonly shiftKey: boolean
}

const KEY_ALIASES: Readonly<Record<string, string>> = {
  esc: "escape",
  return: "enter",
  " ": "space",
  up: "arrowup",
  down: "arrowdown",
  left: "arrowleft",
  right: "arrowright",
  del: "delete",
}

const canonicalKey = (key: string) => {
  const lower = key.toLowerCase()
  return KEY_ALIASES[lower] ?? lower
}

const serialize = ({ ctrl, alt, shift, meta, key }: Chord) =>
  [ctrl && "ctrl", alt && "alt", shift && "shift", meta && "meta", key].filter(Boolean).join("+")

const parse = (text: string, { mac }: Platform): Chord | null => {
  const trimmed = text.trim()
  if (trimmed === "" || /\s/.test(trimmed)) return null
  // "mod++" binds the plus key.
  const parts = trimmed.endsWith("++")
    ? [...trimmed.slice(0, -2).split("+"), "+"]
    : trimmed.split("+")
  const key = parts.pop()
  if (key === undefined || key === "") return null
  const chord = { ctrl: false, alt: false, shift: false, meta: false, key: canonicalKey(key) }
  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "mod":
        if (mac) chord.meta = true
        else chord.ctrl = true
        break
      case "ctrl":
      case "control":
        chord.ctrl = true
        break
      case "alt":
      case "option":
        chord.alt = true
        break
      case "shift":
        chord.shift = true
        break
      case "cmd":
      case "meta":
      case "super":
        chord.meta = true
        break
      default:
        return null
    }
  }
  return chord
}

// The form two keys share when they are the same key; null for a key the app cannot match.
export const normalizeKey = (text: string, platform: Platform): string | null => {
  const chord = parse(text, platform)
  return chord === null ? null : serialize(chord)
}

// The written forms a pressed key can match.
export const eventKeys = (event: PressedKey): ReadonlyArray<string> => {
  const pressed = {
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
    key: canonicalKey(event.key),
  }
  // The layout may need Shift or Option to type a symbol, so the symbol alone names it.
  const symbol = /^[^\p{L}\p{N}]$/u.test(event.key)
  const typed = symbol ? { ...pressed, shift: false, alt: false } : pressed
  // Option changes the character typed on macOS, so the physical key names it too.
  const physical = event.altKey ? /^(?:Key([A-Z])|Digit(\d))$/.exec(event.code) : null
  const forms = [serialize(typed)]
  if (physical)
    forms.push(serialize({ ...pressed, key: (physical[1] ?? physical[2]!).toLowerCase() }))
  return forms
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
}

const MAC_KEY_LABELS: Readonly<Record<string, string>> = { backspace: "⌫" }

const keyLabel = (key: string, { mac }: Platform) =>
  (mac ? MAC_KEY_LABELS[key] : undefined) ??
  KEY_LABELS[key] ??
  (key.length === 1 ? key.toUpperCase() : key[0]!.toUpperCase() + key.slice(1))

export const formatKey = (text: string, platform: Platform): string => {
  const chord = parse(text, platform)
  if (chord === null) return text
  const key = keyLabel(chord.key, platform)
  if (platform.mac) {
    return [chord.ctrl && "⌃", chord.alt && "⌥", chord.shift && "⇧", chord.meta && "⌘", key]
      .filter(Boolean)
      .join("")
  }
  return [
    chord.ctrl && "Ctrl",
    chord.shift && "Shift",
    chord.alt && "Alt",
    chord.meta && "Super",
    key,
  ]
    .filter(Boolean)
    .join("+")
}
