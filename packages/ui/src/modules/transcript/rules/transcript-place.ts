import type { StateSnapshot } from "react-virtuoso"

export interface TranscriptPlace {
  readonly firstIndex: number
  readonly atEnd: boolean
  readonly list: StateSnapshot
}

export const placeToRestore = (place: TranscriptPlace | null, firstIndex: number) =>
  place === null || place.firstIndex !== firstIndex || place.atEnd ? undefined : place
