import { useState, type ReactNode } from "react"
import { Button, IconButton } from "../../src/core/components/button/button.tsx"
import { Dialog } from "../../src/core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../../src/core/components/error-message/error-message.tsx"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import { ListRow } from "../../src/core/components/list-row/list-row.tsx"
import { Select } from "../../src/core/components/select/select.tsx"
import { Text } from "../../src/core/components/text/text.tsx"
import { TextField } from "../../src/core/components/text-field/text-field.tsx"
import "../../src/modules/setting/ui/settings-nav.css"
import "../../src/modules/setting/ui/settings-page.css"
import {
  daysOf,
  formatBytes,
  makeImages,
  olderThan,
  plural,
  spaceOf,
  type StoredImage,
} from "./fake.ts"
import { ImageIcon } from "./image-icon.tsx"

const SECTIONS: ReadonlyArray<{ title: string; icon: IconName | "image" }> = [
  { title: "Tabs", icon: "app-window" },
  { title: "Worktrees", icon: "worktree" },
  { title: "Files", icon: "folder" },
  { title: "Sidebar", icon: "panel-left" },
  { title: "Agents", icon: "robot" },
  { title: "Images", icon: "image" },
  { title: "Updates", icon: "download" },
  { title: "Command line", icon: "terminal" },
]

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="proto-app">
      <div className="proto-card">
        <div className="proto-card-top">
          <span className="proto-lights">
            <i />
            <i />
            <i />
          </span>
        </div>
        <nav className="iv-settings-nav" aria-label="Settings sections">
          <div className="iv-settings-nav__head">
            <IconButton icon="arrow-left" label="Back to sessions" size="sm" />
            <h1 className="iv-settings-nav__title">Settings</h1>
          </div>
          <ul className="iv-settings-nav__list">
            {SECTIONS.map((section) => (
              <li key={section.title}>
                <ListRow
                  leading={
                    section.icon === "image" ? (
                      <ImageIcon size={14} />
                    ) : (
                      <Icon name={section.icon} size={14} />
                    )
                  }
                  title={section.title}
                  selected={section.title === "Images"}
                  onSelect={() => {}}
                />
              </li>
            ))}
          </ul>
          <div className="iv-settings-nav__foot">
            <ListRow
              leading={<Icon name="brackets-curly" size={14} />}
              title="Open settings.json"
              onSelect={() => {}}
            />
            <div className="iv-settings-nav__version">
              <Text size="xs" tone="faint">
                ivin 0.5.0
              </Text>
            </div>
          </div>
        </nav>
      </div>
      <div className="proto-main">
        <div className="proto-dragbar" />
        <div className="iv-settings-page">
          <section className="iv-settings-page__column">{children}</section>
        </div>
      </div>
    </div>
  )
}

type Scope = { readonly days: number } | "all"

function useStore() {
  const [images, setImages] = useState<ReadonlyArray<StoredImage>>(makeImages)
  const [deleting, setDeleting] = useState(false)
  const remove = (scope: Scope) => {
    setDeleting(true)
    const gone = new Set(olderThan(images, scope === "all" ? null : scope.days).map((i) => i.id))
    setTimeout(() => {
      setImages((all) => all.filter((image) => !gone.has(image.id)))
      setDeleting(false)
    }, 450)
  }
  const sessions = new Set(images.map((image) => image.sessionId)).size
  return { images, sessions, deleting, remove }
}

function ConfirmDialog({
  scope,
  images,
  onCancel,
  onConfirm,
}: {
  scope: Scope | null
  images: ReadonlyArray<StoredImage>
  onCancel: () => void
  onConfirm: (scope: Scope) => void
}) {
  // Kept while the dialog closes, so its text does not change during the exit.
  const [shown, setShown] = useState<Scope | null>(scope)
  if (scope !== null && scope !== shown) setShown(scope)
  const target = shown ?? "all"
  const space = spaceOf(olderThan(images, target === "all" ? null : target.days))
  const title =
    target === "all"
      ? `Delete all ${plural(space.images, "image")}?`
      : `Delete ${plural(space.images, "image")} sent more than ${plural(target.days, "day")} ago?`
  return (
    <Dialog
      open={scope !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={title}
      description={`This frees ${formatBytes(space.bytes)}. Their messages keep their text and show each image as deleted. This cannot be undone.`}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={() => onConfirm(target)}>
            {target === "all" ? "Delete all images" : "Delete images"}
          </Button>
        </>
      }
    />
  )
}

function Head({ description }: { description: ReactNode }) {
  return (
    <>
      <h2 className="iv-settings-page__title">Images</h2>
      <Text tone="muted">{description}</Text>
    </>
  )
}

function DaysField({ text, onText }: { text: string; onText: (text: string) => void }) {
  return (
    <div className="iv-settings-page__count-field">
      <TextField
        label="Days"
        value={text}
        inputMode="numeric"
        aria-invalid={daysOf(text) === null}
        onChange={(event) => onText(event.target.value)}
      />
      <Text tone="muted">days</Text>
    </div>
  )
}

const DAYS_INVALID = "Enter a whole number of days, 1 or more."

// The settings list's own rows: the space, then one row per action.
export function Rows() {
  const store = useStore()
  const [text, setText] = useState("30")
  const [confirm, setConfirm] = useState<Scope | null>(null)
  const days = daysOf(text)
  const total = spaceOf(store.images)
  const old = spaceOf(olderThan(store.images, days))
  const empty = total.images === 0
  return (
    <Frame>
      <Head description="The images you sent to agents. ivin keeps them until you delete them here." />
      <ul className="iv-settings-page__list">
        <li className="iv-settings-page__setting">
          <div className="iv-settings-page__setting-text">
            <Text weight="medium">Space taken</Text>
            <Text size="sm" tone="muted">
              {empty
                ? "No image is stored."
                : `${plural(total.images, "image")}, sent in ${plural(store.sessions, "session")}.`}
            </Text>
          </div>
          <span className="proto-figure">{store.deleting ? "…" : formatBytes(total.bytes)}</span>
        </li>
        <li className="iv-settings-page__setting">
          <div className="iv-settings-page__setting-text">
            <Text weight="medium">Delete old images</Text>
            <Text size="sm" tone="muted">
              Deletes the images sent more than this many days ago. Their messages keep their text.
            </Text>
            {days === null ? (
              <ErrorMessage message={DAYS_INVALID} />
            ) : (
              <Text size="xs" tone="faint">
                {old.images === 0
                  ? `No image is older than ${plural(days, "day")}.`
                  : `${plural(old.images, "image")} · ${formatBytes(old.bytes)}`}
              </Text>
            )}
          </div>
          <div className="proto-controls">
            <DaysField text={text} onText={setText} />
            <Button
              disabled={days === null || old.images === 0 || store.deleting}
              onClick={() => days !== null && setConfirm({ days })}
            >
              Delete…
            </Button>
          </div>
        </li>
        <li className="iv-settings-page__setting">
          <div className="iv-settings-page__setting-text">
            <Text weight="medium">Delete all images</Text>
            <Text size="sm" tone="muted">
              Deletes every image you sent, in every session.
            </Text>
          </div>
          <Button disabled={empty || store.deleting} onClick={() => setConfirm("all")}>
            Delete all…
          </Button>
        </li>
      </ul>
      <ConfirmDialog
        scope={confirm}
        images={store.images}
        onCancel={() => setConfirm(null)}
        onConfirm={(scope) => {
          setConfirm(null)
          store.remove(scope)
        }}
      />
    </Frame>
  )
}

// A figure and a bar first; the bar shows the share an action frees while it is hovered or focused.
export function Gauge() {
  const store = useStore()
  const [text, setText] = useState("30")
  const [confirm, setConfirm] = useState<Scope | null>(null)
  const [aimed, setAimed] = useState<"old" | "all" | null>(null)
  const days = daysOf(text)
  const total = spaceOf(store.images)
  const old = spaceOf(olderThan(store.images, days))
  const empty = total.images === 0
  const share =
    aimed === "all" ? 1 : aimed === "old" && total.bytes > 0 ? old.bytes / total.bytes : 0
  const aim = (target: "old" | "all") => ({
    onPointerEnter: () => setAimed(target),
    onPointerLeave: () => setAimed(null),
    onFocus: () => setAimed(target),
    onBlur: () => setAimed(null),
  })
  return (
    <Frame>
      <Head description="The images you sent to agents. ivin keeps them until you delete them here." />
      <div className="proto-gauge">
        <div className="proto-gauge-figures">
          <span className="proto-gauge-total">{formatBytes(total.bytes)}</span>
          <Text size="sm" tone="muted">
            {empty
              ? "No image is stored."
              : `${plural(total.images, "image")}, sent in ${plural(store.sessions, "session")}`}
          </Text>
        </div>
        <div className="proto-gauge-bar" data-deleting={store.deleting || undefined}>
          <span className="proto-gauge-freed" style={{ width: `${share * 100}%` }} />
        </div>
      </div>
      <ul className="iv-settings-page__list">
        <li className="iv-settings-page__setting proto-gauge-row" {...aim("old")}>
          <div className="iv-settings-page__setting-text">
            <span className="proto-inline">
              <Text weight="medium">Delete images older than</Text>
              <DaysField text={text} onText={setText} />
            </span>
            {days === null ? (
              <ErrorMessage message={DAYS_INVALID} />
            ) : (
              <Text size="sm" tone="muted">
                {old.images === 0
                  ? `No image is older than ${plural(days, "day")}.`
                  : `Frees ${formatBytes(old.bytes)}, ${plural(old.images, "image")}.`}
              </Text>
            )}
          </div>
          <Button
            disabled={days === null || old.images === 0 || store.deleting}
            onClick={() => days !== null && setConfirm({ days })}
          >
            Delete…
          </Button>
        </li>
        <li className="iv-settings-page__setting proto-gauge-row" {...aim("all")}>
          <div className="iv-settings-page__setting-text">
            <Text weight="medium">Delete all images</Text>
            <Text size="sm" tone="muted">
              {empty ? "Nothing to free." : `Frees ${formatBytes(total.bytes)}.`}
            </Text>
          </div>
          <Button disabled={empty || store.deleting} onClick={() => setConfirm("all")}>
            Delete all…
          </Button>
        </li>
      </ul>
      <ConfirmDialog
        scope={confirm}
        images={store.images}
        onCancel={() => setConfirm(null)}
        onConfirm={(scope) => {
          setConfirm(null)
          setAimed(null)
          store.remove(scope)
        }}
      />
    </Frame>
  )
}

// One row: the space in the section's sentence, one Delete button whose scope a Select picks.
export function OneAction() {
  const store = useStore()
  const [which, setWhich] = useState<"old" | "all">("old")
  const [text, setText] = useState("30")
  const [confirm, setConfirm] = useState<Scope | null>(null)
  const days = daysOf(text)
  const total = spaceOf(store.images)
  const target = which === "all" ? total : spaceOf(olderThan(store.images, days))
  const invalid = which === "old" && days === null
  return (
    <Frame>
      <Head
        description={
          total.images === 0 ? (
            "No image is stored. The images you send to agents show up here."
          ) : (
            <>
              The images you sent to agents take{" "}
              <Text weight="medium">{store.deleting ? "…" : formatBytes(total.bytes)}</Text> (
              {plural(total.images, "image")}). ivin keeps them until you delete them.
            </>
          )
        }
      />
      <ul className="iv-settings-page__list">
        <li className="iv-settings-page__setting">
          <div className="iv-settings-page__setting-text">
            <Text weight="medium">Delete images</Text>
            <Text size="sm" tone="muted">
              Their messages keep their text and show each image as deleted.
            </Text>
            {invalid && <ErrorMessage message={DAYS_INVALID} />}
          </div>
          <div className="proto-controls">
            <Select
              label="Which images"
              value={which}
              options={[
                { value: "old", label: "Older than" },
                { value: "all", label: "All images" },
              ]}
              onChange={(value) => setWhich(value as "old" | "all")}
            />
            {which === "old" && <DaysField text={text} onText={setText} />}
            <Button
              disabled={invalid || target.images === 0 || store.deleting}
              onClick={() =>
                which === "all" ? setConfirm("all") : days !== null && setConfirm({ days })
              }
            >
              {invalid || target.images === 0
                ? "Delete…"
                : `Delete ${plural(target.images, "image")}…`}
            </Button>
          </div>
        </li>
      </ul>
      <ConfirmDialog
        scope={confirm}
        images={store.images}
        onCancel={() => setConfirm(null)}
        onConfirm={(scope) => {
          setConfirm(null)
          store.remove(scope)
        }}
      />
    </Frame>
  )
}
