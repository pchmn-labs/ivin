import { PreviewCard } from "@base-ui/react/preview-card"
import { useAtomValue } from "@effect/atom-react"
import { Slot } from "../../../app/slot-renderer.tsx"
import { openSessionsAtom } from "../atoms/open-sessions.ts"
import type { Place } from "./session-card.tsx"

function Sections({ sessionId }: { sessionId: string }) {
  const session = useAtomValue(openSessionsAtom).find((s) => s.id === sessionId)
  return (
    <div className="iv-session-card__sections">
      {session === undefined ? null : <Slot slot="session.card" props={{ session }} />}
    </div>
  )
}

export default function SessionCardParts({
  place,
  payload,
}: {
  place: Place
  payload: string | undefined
}) {
  return (
    <PreviewCard.Portal>
      <PreviewCard.Positioner
        className="iv-session-card__positioner"
        side={place === "row" ? "right" : "bottom"}
        align="start"
        sideOffset={place === "row" ? 10 : 6}
        collisionPadding={8}
      >
        <PreviewCard.Popup className="iv-session-card" data-testid="session-card">
          <PreviewCard.Viewport className="iv-session-card__viewport">
            {payload === undefined ? null : <Sections sessionId={payload} />}
          </PreviewCard.Viewport>
        </PreviewCard.Popup>
      </PreviewCard.Positioner>
    </PreviewCard.Portal>
  )
}
