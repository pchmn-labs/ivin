import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react"
import type { ImageSpace } from "@ivin/contracts/transcript"
import { AsyncResult } from "effect/reactivity"
import { useId, useState } from "react"
import { Button } from "../../../core/components/button/button.tsx"
import { Dialog } from "../../../core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../../core/components/error-message/error-message.tsx"
import { Text } from "../../../core/components/text/text.tsx"
import { TextField } from "../../../core/components/text-field/text-field.tsx"
import { byteSize } from "../../../shared/rules/byte-size.ts"
import { deleteImagesAtom } from "../../transcript/atoms/delete-images.ts"
import { imageSpaceOf } from "../../transcript/atoms/get-image-space.ts"
import {
  DAYS_INVALID,
  type DeleteScope,
  deleteImagesDescription,
  deleteImagesTitle,
  IMAGES_NOT_DELETED,
  inactiveImagesSummary,
  olderImagesSummary,
  SPACE_NOT_READ,
  storedImagesSummary,
} from "../../transcript/rules/image-space.ts"
import { countOf } from "../rules/count-of.ts"

const EMPTY: ImageSpace = { images: 0, bytes: 0 }

// The last space read stays on screen while the server reads it again.
const spaceIn = (result: AsyncResult.AsyncResult<ImageSpace, unknown>) =>
  AsyncResult.isSuccess(result) ? result.value : null

function ConfirmDelete({
  scope,
  onCancel,
  onConfirm,
}: {
  scope: DeleteScope | undefined
  onCancel: () => void
  onConfirm: (scope: DeleteScope) => void
}) {
  // Kept while the dialog closes, so its words do not change during the exit.
  const [shown, setShown] = useState<DeleteScope>(scope ?? "all")
  if (scope !== undefined && scope !== shown) setShown(scope)
  const space = spaceIn(useAtomValue(imageSpaceOf(shown))) ?? EMPTY
  return (
    <Dialog
      open={scope !== undefined}
      onOpenChange={(open) => !open && onCancel()}
      title={deleteImagesTitle(shown, space)}
      description={deleteImagesDescription(space)}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={() => onConfirm(shown)}>
            {shown === "all" ? "Delete all images" : "Delete images"}
          </Button>
        </>
      }
    />
  )
}

export function ImagesSection() {
  const totalResult = useAtomValue(imageSpaceOf("all"))
  const refreshTotal = useAtomRefresh(imageSpaceOf("all"))
  const [text, setText] = useState("30")
  const days = countOf(text, 1)
  const olderResult = useAtomValue(imageSpaceOf(days ?? 1))
  const inactiveResult = useAtomValue(imageSpaceOf("inactive"))
  const [deleting, remove] = useAtom(deleteImagesAtom)
  const [asked, setAsked] = useState<DeleteScope | undefined>(undefined)
  const [started, setStarted] = useState<DeleteScope | undefined>(undefined)
  const oldDescriptionId = useId()
  const inactiveDescriptionId = useId()
  const allDescriptionId = useId()

  const total = spaceIn(totalResult)
  const older = spaceIn(olderResult)
  const inactive = spaceIn(inactiveResult)
  const busy = deleting.waiting
  const failedOn = AsyncResult.isFailure(deleting) && !busy ? started : undefined
  const start = (scope: DeleteScope) => {
    setAsked(undefined)
    setStarted(scope)
    remove(scope)
  }
  const failure = (row: "old" | "inactive" | "all") =>
    failedOn !== undefined &&
    (typeof failedOn === "number" ? "old" : failedOn) === row && (
      <ErrorMessage message={IMAGES_NOT_DELETED} onRetry={() => start(failedOn)} />
    )

  return (
    <>
      <li className="iv-settings-page__setting">
        <div className="iv-settings-page__setting-text">
          <Text weight="medium">Space taken</Text>
          {total !== null && (
            <Text size="sm" tone="muted">
              {storedImagesSummary(total)}
            </Text>
          )}
          {AsyncResult.isFailure(totalResult) && (
            <ErrorMessage message={SPACE_NOT_READ} onRetry={refreshTotal} />
          )}
        </div>
        {total !== null && <span className="iv-images-section__size">{byteSize(total.bytes)}</span>}
      </li>
      <li className="iv-settings-page__setting">
        <div className="iv-settings-page__setting-text">
          <Text weight="medium">Delete old images</Text>
          <div id={oldDescriptionId}>
            <Text size="sm" tone="muted">
              Deletes the images sent more than this many days ago. Their messages keep their text.
            </Text>
          </div>
          {days === null ? (
            <ErrorMessage message={DAYS_INVALID} />
          ) : (
            older !== null && (
              <Text size="xs" tone="faint">
                {olderImagesSummary(older, days)}
              </Text>
            )
          )}
          {failure("old")}
        </div>
        <div className="iv-images-section__controls">
          <div className="iv-settings-page__count-field">
            <TextField
              label="Delete images older than"
              value={text}
              inputMode="numeric"
              aria-invalid={days === null}
              aria-describedby={oldDescriptionId}
              onChange={(event) => setText(event.target.value)}
            />
            <Text tone="muted">days</Text>
          </div>
          <Button
            disabled={days === null || older === null || older.images === 0 || busy}
            onClick={() => days !== null && setAsked(days)}
            aria-describedby={oldDescriptionId}
          >
            Delete…
          </Button>
        </div>
      </li>
      <li className="iv-settings-page__setting">
        <div className="iv-settings-page__setting-text">
          <Text weight="medium">Delete images of inactive sessions</Text>
          <div id={inactiveDescriptionId}>
            <Text size="sm" tone="muted">
              Deletes the images of every session with no tab, archived or not.
            </Text>
          </div>
          {inactive !== null && (
            <Text size="xs" tone="faint">
              {inactiveImagesSummary(inactive)}
            </Text>
          )}
          {failure("inactive")}
        </div>
        <Button
          disabled={inactive === null || inactive.images === 0 || busy}
          onClick={() => setAsked("inactive")}
          aria-label="Delete the images of inactive sessions…"
          aria-describedby={inactiveDescriptionId}
        >
          Delete…
        </Button>
      </li>
      <li className="iv-settings-page__setting">
        <div className="iv-settings-page__setting-text">
          <Text weight="medium">Delete all images</Text>
          <div id={allDescriptionId}>
            <Text size="sm" tone="muted">
              Deletes every image you sent, in every session.
            </Text>
          </div>
          {failure("all")}
        </div>
        <Button
          disabled={total === null || total.images === 0 || busy}
          onClick={() => setAsked("all")}
          aria-describedby={allDescriptionId}
        >
          Delete all…
        </Button>
      </li>
      <ConfirmDelete scope={asked} onCancel={() => setAsked(undefined)} onConfirm={start} />
    </>
  )
}
