import type { StateSnapshot } from "react-virtuoso"

export interface SentMessagePlace {
  readonly id: string
  // Unknown while the view was still scrolling to the message.
  readonly top: number | undefined
  readonly room: number
  readonly userScrolled: boolean
}

export interface TranscriptPlace {
  readonly firstIndex: number
  readonly atEnd: boolean
  readonly list: StateSnapshot
  readonly sent: SentMessagePlace | undefined
}

export const placeToRestore = (place: TranscriptPlace | null, firstIndex: number) =>
  place === null || place.firstIndex !== firstIndex || (place.atEnd && !place.sent)
    ? undefined
    : place
