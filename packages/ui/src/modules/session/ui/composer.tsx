import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import type { RunOptions, Session } from "@ivin/contracts/session"
import type { RunOption } from "@ivin/contracts/transcript"
import type { ActionFailure } from "@ivin/plugin-api/ui"
import { Cause, Exit } from "effect"
import { AsyncResult } from "effect/reactivity"
import { useEffect, useRef, useState } from "react"
import { hoveredImageAtom, imageViewerAtom } from "../../transcript/atoms/image-viewer.ts"
import { imageDataUrl } from "../../transcript/rules/image-url.ts"
import { ImagePreview } from "../../transcript/ui/image-preview.tsx"
import { readImageFile } from "../adapters/read-image-file.ts"
import { draftOf } from "../atoms/draft.ts"
import {
  type Draft,
  type DraftImage,
  draftImages,
  emptyDraft,
  nextImageNumber,
} from "../rules/draft.ts"
import { type ImageRefusal, imageRefusal, refusalMessage } from "../rules/image-refusal.ts"
import { DraftImages } from "./draft-images.tsx"
import { type MessageEditorHandle, MessageEditor, carriesFiles } from "./message-editor.tsx"
import { Slot } from "../../../app/slot-renderer.tsx"
import { useCommandHandler } from "../../command/hooks/use-command-handler.ts"
import { useKeyHint } from "../../keybinding/hooks/use-key-hint.ts"
import { ActionSheet } from "../../../core/components/action-sheet/action-sheet.tsx"
import { Button, IconButton } from "../../../core/components/button/button.tsx"
import {
  ErrorMessage,
  type ErrorMessageProps,
} from "../../../core/components/error-message/error-message.tsx"
import { Stack } from "../../../core/components/stack/stack.tsx"
import { BranchPicker } from "./branch-picker.tsx"
import { RunOptionsMenu, type RunOptionsMenuState } from "./run-options-menu.tsx"
import { getHarnessAtom } from "../../server/atoms/get-harness.ts"
import { PickWorkingFolder } from "./pick-working-folder.tsx"
import { SessionLocation } from "./session-location.tsx"
import { WorkingFolderPicker } from "./working-folder-picker.tsx"
import { useSessionLocation } from "../hooks/use-session-location.ts"
import { workingFolderChoiceOf } from "../atoms/working-folder-choice.ts"
import { interruptSessionAtom } from "../atoms/interrupt-session.ts"
import { sessionsOf } from "../atoms/list-sessions.ts"
import { HARNESSES } from "../rules/harnesses.ts"
import { RUN_OPTIONS, goBackLabel, relaunchFailureText } from "../rules/run-options.ts"
import { setRunOptionsAtom } from "../atoms/set-run-options.ts"
import { isRunning } from "../rules/is-running.ts"
import { sendMessageFailure, setRunOptionsFailure } from "../rules/failure-message.ts"
import { statusLabel } from "../rules/status-label.ts"
import { sendMessageAtom } from "../atoms/send-message.ts"
import "./composer.css"

export function Composer({ projectPath, sessionId }: { projectPath: string; sessionId: string }) {
  const [draft, setDraft] = useAtom(draftOf(sessionId))
  const text = draft.text
  const root = useRef<HTMLDivElement>(null)
  const editor = useRef<MessageEditorHandle>(null)
  const [failure, setFailure] = useState<(ActionFailure & { draft: Draft }) | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [dragging, setDragging] = useState(0)
  const [preview, setPreview] = useState<{ image: DraftImage; anchor: HTMLElement } | null>(null)
  const [hoveredImage, setHoveredImage] = useAtom(hoveredImageAtom)
  const openViewer = useAtomSet(imageViewerAtom)
  const choice = useAtomValue(workingFolderChoiceOf(sessionId))
  const send = useAtomSet(sendMessageAtom, { mode: "promiseExit" })
  const interrupt = useAtomSet(interruptSessionAtom)
  const session = useAtomValue(sessionsOf(projectPath).item(sessionId))
  const running = isRunning(session?.status)
  const preparing = session?.status === "preparing_worktree"
  const choosing = session !== undefined && !session.started && !preparing
  const harness = session && HARNESSES[session.harness]
  const setRunOptions = useAtomSet(setRunOptionsAtom, { mode: "promiseExit" })
  const [optionsFailure, setOptionsFailure] = useState<
    (ActionFailure & { options: Partial<RunOptions> }) | null
  >(null)
  const relaunchFailure = session?.relaunchFailure ?? null
  const relaunchFailureKey = relaunchFailure && JSON.stringify(relaunchFailure)
  const [menu, setMenu] = useState<RunOptionsMenuState>({ open: false, start: "model" })
  const serverHarness = AsyncResult.getOrElse(useAtomValue(getHarnessAtom), () => null)
  const offered = session && serverHarness?.id === session.harness ? serverHarness.runOptions : null

  useEffect(() => {
    if (relaunchFailure === null) return
    setDraft((current) =>
      current.text === "" ? { ...current, text: relaunchFailure.message } : current,
    )
  }, [relaunchFailureKey])

  const changeRunOptions = (options: Partial<RunOptions>) => {
    setOptionsFailure(null)
    void setRunOptions({ projectPath, sessionId, options }).then((exit) => {
      if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
      setOptionsFailure({ options, ...setRunOptionsFailure(Cause.squash(exit.cause), options) })
    })
  }

  const images = draftImages(draft)
  const maxImageBytes = harness?.maxImageBytes ?? 0

  const sendDraft = (sent: Draft) => {
    if (preparing) return
    setFailure(null)
    setRefusal(null)
    setDraft((current) => (current.text === sent.text ? emptyDraft : current))
    const workingFolder = choosing ? choice : undefined
    void send({
      projectPath,
      sessionId,
      text: sent.text,
      images: draftImages(sent).map(({ id, number, mediaType, base64 }) => ({
        id,
        number,
        mediaType,
        base64,
      })),
      ...(workingFolder && { workingFolder }),
    }).then((exit) => {
      if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) return
      // Text typed since the send is newer than the failed message, so it wins.
      setDraft((current) => (current.text === "" ? sent : current))
      setFailure({ draft: sent, ...sendMessageFailure(Cause.squash(exit.cause)) })
    })
  }
  const submit = () => {
    if (text.trim() !== "") sendDraft(draft)
  }

  const addImageFiles = async (files: ReadonlyArray<File>, at: Range | null) => {
    const refused: Array<ImageRefusal> = []
    const accepted: Array<File> = []
    for (const file of files) {
      const problem = imageRefusal(file, maxImageBytes)
      if (problem) refused.push(problem)
      else accepted.push(file)
    }
    setRefusal(
      refused.length === 0
        ? null
        : refusalMessage(refused, harness?.name ?? "the agent", maxImageBytes),
    )
    if (accepted.length === 0) return
    const contents = await Promise.all(accepted.map(readImageFile))
    let number = nextImageNumber(session?.lastImageNumber ?? 0, draft)
    const added: Array<DraftImage> = accepted.map((file, i) => ({
      id: crypto.randomUUID(),
      number: number++,
      mediaType: file.type as DraftImage["mediaType"],
      base64: contents[i] ?? "",
      name: file.name || "Pasted image",
    }))
    setDraft((current) => ({ ...current, images: [...current.images, ...added] }))
    editor.current?.insertImages(added, at)
  }

  const openDraftImage = (imageId: string) => openViewer({ sessionId, images: "draft", imageId })
  useCommandHandler("composer.send", submit)
  const sendHint = useKeyHint("Send", "composer.send")
  const interruptHint = useKeyHint("Interrupt", "session.interrupt")

  const isEmptyComposer = (target: EventTarget | null) =>
    text === "" &&
    target instanceof HTMLElement &&
    target.closest(".iv-message-editor") !== null &&
    target.closest(".iv-composer") === root.current

  const shown: ErrorMessageProps | null = failure
    ? {
        message: failure.text,
        ...(failure.retryable && { onRetry: () => sendDraft(failure.draft) }),
      }
    : refusal !== null
      ? { message: refusal }
      : optionsFailure
        ? {
            message: optionsFailure.text,
            ...(optionsFailure.retryable && {
              onRetry: () => changeRunOptions(optionsFailure.options),
            }),
          }
        : null
  const changed: RunOption =
    (relaunchFailure &&
      RUN_OPTIONS.find((option) => session?.[option] !== relaunchFailure.previous[option])) ??
    "model"
  const relaunchSheet = session && relaunchFailure && (
    <ActionSheet
      tone="danger"
      icon="circle-alert"
      title={relaunchFailureText(offered, session, relaunchFailure.previous)}
      data-testid="composer-relaunch-failure"
    >
      {relaunchFailure.error !== null && (
        <p className="iv-composer__sheet-error">{relaunchFailure.error}</p>
      )}
      <div className="iv-composer__sheet-row">
        <span className="iv-composer__sheet-hint">Your message is back in the field.</span>
        <Button variant="ghost" size="sm" onClick={() => setMenu({ open: true, start: changed })}>
          Pick another
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => changeRunOptions(relaunchFailure.previous)}
        >
          {goBackLabel(offered, session, relaunchFailure.previous)}
        </Button>
      </div>
    </ActionSheet>
  )
  const alert = shown && (
    <div className="iv-composer__alert" data-testid="composer-alert">
      <ErrorMessage {...shown} />
    </div>
  )
  const statusLine = (
    <div className="iv-composer__statusline">
      {session && <StatusLocation session={session} choosing={choosing} />}
      <div className="iv-composer__status-slot" data-testid="composer-status">
        <Slot slot="composer.status" props={{ sessionId }} />
      </div>
    </div>
  )

  if (session?.workingFolderDeleted) {
    // Outside the composer's keybinding area, so Enter picks the folder rather than sending.
    return (
      <div className="iv-composer">
        {alert}
        <PickWorkingFolder session={session} />
        {statusLine}
      </div>
    )
  }

  return (
    <div className="iv-composer" ref={root} data-keybinding-area="composer">
      {alert}
      {session && <Slot slot="composer.above" props={{ session, isEmptyComposer }} />}
      {relaunchSheet}
      <div
        className="iv-composer__surface"
        data-dragging={dragging > 0 || undefined}
        onDragEnter={(event) => {
          if (carriesFiles(event.dataTransfer)) setDragging((n) => n + 1)
        }}
        onDragLeave={(event) => {
          if (carriesFiles(event.dataTransfer)) setDragging((n) => Math.max(0, n - 1))
        }}
        onDragOver={(event) => {
          if (carriesFiles(event.dataTransfer)) event.preventDefault()
        }}
        onDropCapture={() => setDragging(0)}
        onDrop={(event) => {
          if (!carriesFiles(event.dataTransfer)) return
          event.preventDefault()
          void addImageFiles([...event.dataTransfer.files], null)
        }}
      >
        <DraftImages
          images={images}
          onOpen={openDraftImage}
          onRemove={(number) => {
            setRefusal(null)
            editor.current?.removeImage(number)
          }}
        />
        <MessageEditor
          ref={editor}
          label="Message"
          placeholder={`Message ${harness?.name ?? "the agent"}`}
          value={text}
          images={draft.images}
          hotImageId={hoveredImage}
          onChange={(next) => setDraft((current) => ({ ...current, text: next }))}
          onImageFiles={(files, at) => void addImageFiles(files, at)}
          onOpenImage={openDraftImage}
          onHoverImage={(imageId, anchor) => {
            setHoveredImage(imageId)
            const image = draft.images.find((candidate) => candidate.id === imageId)
            setPreview(image && anchor ? { image, anchor } : null)
          }}
        />
        {preview && (
          <ImagePreview
            anchor={preview.anchor}
            number={preview.image.number}
            src={imageDataUrl(preview.image)}
          />
        )}
        <Stack direction="row" align="end" justify="between" gap={2}>
          <Stack direction="row" align="center" gap={3}>
            {session && (
              <RunOptionsMenu
                session={session}
                offered={offered}
                previous={relaunchFailure?.previous ?? null}
                state={menu}
                onStateChange={setMenu}
                onChange={changeRunOptions}
              />
            )}
          </Stack>
          {session && (
            // The state shows on the session mark; screen readers hear it from here.
            <span
              className="iv-visually-hidden"
              role="status"
              data-testid="composer-session-status"
            >
              {statusLabel(session.status)}
            </span>
          )}
          {/* A working session with an empty field offers Stop; typed text can still be sent. */}
          {running && text.trim() === "" ? (
            <IconButton
              icon="square"
              label="Interrupt"
              tooltip={interruptHint}
              variant="secondary"
              onClick={() => interrupt({ projectPath, sessionId })}
            />
          ) : (
            <IconButton
              icon="send"
              label="Send"
              tooltip={sendHint}
              variant="primary"
              disabled={text.trim() === "" || preparing}
              onClick={submit}
            />
          )}
        </Stack>
      </div>
      {statusLine}
    </div>
  )
}

function StatusLocation({ session, choosing }: { session: Session; choosing: boolean }) {
  const location = useSessionLocation(session)
  // Outside a git repository there is nothing to choose.
  return choosing && location.kind !== "folder" ? (
    <WorkingFolderPicker session={session} location={location} />
  ) : (
    <SessionLocation
      location={location}
      title={session.workingFolder}
      {...(location.branch !== null &&
        location.deleted !== true && {
          branch: <BranchPicker session={session} branch={location.branch} />,
        })}
    />
  )
}
