import { LockIcon as Lock } from "@phosphor-icons/react/dist/csr/Lock"
import { useState, type ReactNode } from "react"
import { Button } from "../../src/core/components/button/button.tsx"
import { CodeView } from "../../src/core/components/code-view/code-view.tsx"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import { Text } from "../../src/core/components/text/text.tsx"
import "../../src/core/components/markdown/markdown.css"
import "../../src/modules/transcript/ui/transcript-view.css"
import "../../src/modules/tab/ui/sub-view-card.css"
import "../../src/modules/file/ui/file-view.css"
import "../../src/modules/file/ui/diff-view.css"
import iconPng from "./files/icon.png"
import markSvg from "./files/mark.svg"
import markSvgSource from "./files/mark.svg?raw"
import brokenPng from "./files/broken.png"

type Direction = "quiet" | "headed" | "marked"
type Bar = "neutral" | "attention"

const FOLDER = "/Users/ana/code/ivin"

type FileSpec =
  | { kind: "image"; src: string; size: string; svgSource?: string }
  | { kind: "text"; text: string }
  | { kind: "too_large"; size: string }

const FILES: Record<string, FileSpec> = {
  "apps/desktop/build/icon.png": { kind: "image", src: iconPng, size: "312 KB" },
  "assets/mark.svg": { kind: "image", src: markSvg, size: "612 B", svgSource: markSvgSource },
  "/Users/ana/.zshrc": {
    kind: "text",
    text: `# Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

export EDITOR="code --wait"
export PNPM_HOME="$HOME/Library/pnpm"
export PATH="$PNPM_HOME:$PATH"

alias gs="git status --short"
alias gl="git log --oneline -20"

# pnpm
export PNPM_HOME="$HOME/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac
# pnpm end
`,
  },
  "/Users/ana/Downloads/mockup.png": { kind: "image", src: iconPng, size: "1.4 MB" },
  "assets/broken.png": { kind: "image", src: brokenPng, size: "18 B" },
  "docs/media/demo.gif": { kind: "too_large", size: "48.2 MB" },
}

const isOutside = (path: string) => path.startsWith("/")
const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1)
const shown = (path: string) => (isOutside(path) ? path.replace("/Users/ana", "~") : path)

function Scene({ bar }: { bar: Bar }) {
  const direction: Direction = "quiet"
  const [open, setOpen] = useState<string[]>(["apps/desktop/build/icon.png"])
  const [selected, setSelected] = useState("apps/desktop/build/icon.png")
  const openFile = (path: string) => {
    setOpen((files) => (files.includes(path) ? files : [...files, path]))
    setSelected(path)
  }
  const close = (path: string) => {
    const index = open.indexOf(path)
    const rest = open.filter((p) => p !== path)
    setOpen(rest)
    if (path === selected) setSelected(rest[index] ?? rest[index - 1] ?? "")
  }

  const P = ({ path, at = "" }: { path: string; at?: string }) => (
    <PathCode direction={direction} path={path} at={at} onOpen={() => openFile(path)} />
  )

  return (
    <div className="proto-app" data-direction={direction}>
      <div className="proto-window">
        <div className="proto-titlebar">
          <div className="proto-tab" data-selected>
            Update the app icon and the mark
          </div>
        </div>
        <div className="proto-body">
          <main className="proto-main">
            <div className="proto-scroll">
              <div className="iv-transcript__column">
                <div className="iv-transcript__item">
                  <div className="proto-bubble">
                    Redraw the mark as an SVG and use it for the app icon. Also, why does my shell
                    print a pnpm warning?
                  </div>
                </div>
                <div className="iv-transcript__item">
                  <div className="proto-calls">
                    <ToolRow direction={direction} icon="file" name="Read" path="/Users/ana/.zshrc" onOpen={openFile} />
                    <ToolRow direction={direction} icon="pencil" name="Write" path="assets/mark.svg" onOpen={openFile} />
                    <ToolRow direction={direction} icon="pencil" name="Edit" path="apps/desktop/build/icon.png" onOpen={openFile} />
                    <ToolRow direction={direction} icon="terminal" name="Bash" arg="pnpm --filter @ivin/desktop icons" />
                  </div>
                </div>
                <div className="iv-transcript__item">
                  <div className="iv-markdown">
                    <p>
                      I redrew the mark in <P path="assets/mark.svg" at=":1" /> and rebuilt{" "}
                      <P path="apps/desktop/build/icon.png" /> from it with{" "}
                      <code>pnpm --filter @ivin/desktop icons</code>.
                    </p>
                    <p>
                      The warning comes from <P path="/Users/ana/.zshrc" at=":11" />, which sets{" "}
                      <code>PNPM_HOME</code> twice. I left it alone, since it is outside the project:
                      delete lines 11 to 15 and run <code>exec zsh</code>.
                    </p>
                    <p>
                      I compared the result with your <P path="/Users/ana/Downloads/mockup.png" />.
                      Two older images did not come through: <P path="assets/broken.png" /> no longer
                      decodes, and <P path="docs/media/demo.gif" /> is too big to keep in the repo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </main>
          {selected !== "" && (
            <section className="iv-sub-view-card proto-card" aria-label="Open files">
              <div className="iv-sub-view-card__row">
                <div className="iv-sub-view-card__tabs" role="tablist" aria-label="Open files">
                  {open.map((path) => (
                    <div
                      key={path}
                      className="iv-sub-view-card__item"
                      role="presentation"
                      data-selected={path === selected || undefined}
                    >
                      <button
                        type="button"
                        role="tab"
                        className="iv-sub-view-card__tab"
                        aria-selected={path === selected}
                        title={path}
                        onClick={() => setSelected(path)}
                      >
                        <span className="iv-sub-view-card__icon" aria-hidden>
                          <Icon name="file" size={14} />
                        </span>
                        <span className="iv-sub-view-card__name">{nameOf(path)}</span>
                      </button>
                      <button
                        type="button"
                        className="iv-sub-view-card__close"
                        tabIndex={-1}
                        aria-label={`Close ${nameOf(path)}`}
                        onClick={() => close(path)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="iv-sub-view-card__body" role="tabpanel" aria-label={nameOf(selected)}>
                <FileStage key={selected} bar={bar} path={selected} />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function PathCode({
  direction,
  path,
  at,
  onOpen,
}: {
  direction: Direction
  path: string
  at: string
  onOpen: () => void
}) {
  return (
    <a
      className="proto-path"
      href={isOutside(path) ? `file://${path}` : path}
      title={direction === "quiet" ? undefined : `Open ${nameOf(path)}`}
      onClick={(event) => {
        event.preventDefault()
        onOpen()
      }}
    >
      <code>
        {direction === "marked" && (
          <span className="proto-path-icon" aria-hidden>
            <Icon name="file" size={12} />
          </span>
        )}
        {path}
        {at}
      </code>
    </a>
  )
}

function ToolRow({
  direction,
  icon,
  name,
  path,
  arg,
  onOpen,
}: {
  direction: Direction
  icon: IconName
  name: string
  path?: string
  arg?: string
  onOpen?: (path: string) => void
}) {
  return (
    <div className="proto-toolrow">
      <Icon name={icon} size={14} />
      <span className="proto-tool-name">{name}</span>
      {path === undefined ? (
        <span className="proto-tool-arg">{arg}</span>
      ) : (
        <span className="proto-tool-arg">
          <button type="button" className="proto-tool-path" onClick={() => onOpen?.(path)}>
            <span className="proto-tool-path-text">{path}</span>
            {direction === "marked" && (
              <span className="proto-tool-path-go" aria-hidden>
                <Icon name="arrow-right" size={12} />
              </span>
            )}
          </button>
        </span>
      )}
    </div>
  )
}

function FileStage({ bar, path }: { bar: Bar; path: string }) {
  const file = FILES[path]!
  const name = nameOf(path)
  const outside = isOutside(path)
  const [revealed, setRevealed] = useState(false)
  const [source, setSource] = useState(false)
  const [actual, setActual] = useState(false)
  const [failed, setFailed] = useState(false)
  const [dims, setDims] = useState<string | null>(null)

  if (file.kind === "too_large" || failed) {
    return (
      <div className="iv-file-view iv-file-view--message">
        <Text tone="muted">
          {file.kind === "too_large"
            ? `${name} is ${file.size}, over the 20 MB ivin shows for an image, so it is not shown.`
            : `${name} cannot be shown: its image data is damaged or in a format ivin cannot read.`}
        </Text>
      </div>
    )
  }

  const isSvg = file.kind === "image" && file.svgSource !== undefined
  const image = file.kind === "image" && !source
  return (
    <div className="iv-file-view">
      {outside && (
        <div className={`proto-ro proto-ro--${bar}`} role="status">
          <span className="proto-ro-icon">
            <Lock size={14} />
          </span>
          <span className="proto-ro-text">
            {name} is outside the working folder, so it cannot be edited.{" "}
            {revealed && <span className="proto-note">Finder opens with {name} selected</span>}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setRevealed(true)}>
            Show in Finder
          </Button>
        </div>
      )}
      {file.kind === "image" && (
        <div className="iv-diff-view__head">
          <span className="iv-diff-view__path" title={path}>
            {shown(path)}
          </span>
          {image && dims && (
            <span className="proto-meta">
              {dims} · {file.size}
            </span>
          )}
          {image && (
            <Button variant="ghost" size="sm" onClick={() => setActual(!actual)}>
              {actual ? "Fit" : "Actual size"}
            </Button>
          )}
          {isSvg && (
            <div className="proto-switch" role="radiogroup" aria-label="Show">
              {(["Image", "Source"] as const).map((label) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={(label === "Source") === source}
                  className="proto-switch-option"
                  onClick={() => setSource(label === "Source")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {file.kind === "text" || source ? (
        <CodeView
          text={file.kind === "text" ? file.text : file.svgSource!}
          fileName={name}
          {...(!outside && { onChange: () => {} })}
        />
      ) : (
        <ImageStage
          direction="headed"
          src={file.src}
          name={name}
          actual={actual}
          onLoad={setDims}
          onError={() => setFailed(true)}
          caption={null}
        />
      )}
    </div>
  )
}

function ImageStage({
  direction,
  src,
  name,
  actual,
  onLoad,
  onError,
  caption,
}: {
  direction: Direction
  src: string
  name: string
  actual: boolean
  onLoad: (dims: string) => void
  onError: () => void
  caption: ReactNode
}) {
  return (
    <div className="proto-stage" data-actual={actual || undefined}>
      <figure className="proto-figure">
        <img
          className="proto-image"
          src={src}
          alt={name}
          onLoad={(event) =>
            onLoad(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)
          }
          onError={onError}
        />
        {direction === "marked" && caption && (
          <figcaption className="proto-caption">{caption}</figcaption>
        )}
      </figure>
    </div>
  )
}

export const Neutral = () => <Scene bar="neutral" />
export const Attention = () => <Scene bar="attention" />
