import { useState, type ReactNode } from "react"
import { Block } from "../../src/core/components/block/block.tsx"
import { Icon, type IconName } from "../../src/core/components/icon/icon.tsx"
import { Stack } from "../../src/core/components/stack/stack.tsx"
import { Text } from "../../src/core/components/text/text.tsx"
import "../../src/core/components/block/block.css"
import "../../src/modules/transcript/ui/transcript-view.css"
import "../../src/modules/transcript/ui/turn-work.css"

const COMMAND = "rm -rf dist .turbo"
const QUESTIONS = [
  { header: "Trigger", question: "Which event should publish a release?" },
  { header: "Targets", question: "Which platforms should it build for?" },
]

export interface Records {
  // The approval record under its tool row, closed when the user pressed Stop.
  readonly approval: ReactNode
  // The questions record, closed when ivin restarted while the session waited for it.
  readonly questions: ReactNode
}

function ToolRow({ icon, name, arg }: { icon: IconName; name: string; arg: string }) {
  return (
    <Stack direction="row" gap={2} align="center">
      <Icon name={icon} size={14} />
      <Text weight="medium">{name}</Text>
      <Stack as="span" grow>
        <Text size="sm" tone="muted" mono truncate>
          {arg}
        </Text>
      </Stack>
    </Stack>
  )
}

function Step({
  sentence,
  phrases,
  children,
}: {
  sentence: string
  phrases: string
  children: ReactNode[]
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="iv-turn__step">
      <div className="iv-turn__sentence">
        <p className="proto-prose">{sentence}</p>
      </div>
      <button
        type="button"
        className="iv-turn__summary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="iv-turn__lead">
          <span className="iv-turn__mark">
            <Icon name="stack" size={14} />
          </span>
          <span className="iv-turn__chevron">
            <Icon name="chevron-right" size={12} />
          </span>
        </span>
        <span className="iv-turn__phrases">{phrases}</span>
      </button>
      {open && (
        <div className="iv-turn__calls">
          {children.map((child, i) => (
            <div key={i} className="iv-turn__call">
              {child}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Turn({
  stopped,
  label,
  children,
}: {
  stopped: boolean
  label: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="iv-turn">
      <button
        type="button"
        className="iv-turn__line iv-turn__line--toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="iv-turn__lead">
          <span
            className="iv-turn__mark"
            data-outcome={stopped ? "stopped" : "silent"}
            data-state={stopped ? "stopped" : undefined}
          >
            <Icon name={stopped ? "square" : "check"} size={14} />
          </span>
          <span className="iv-turn__chevron">
            <Icon name="chevron-right" size={12} />
          </span>
        </span>
        <span className="iv-turn__label">{label}</span>
        <span className="iv-turn__rule" />
      </button>
      {open && <div className="iv-turn__timeline">{children}</div>}
    </div>
  )
}

const Item = ({ children }: { children: ReactNode }) => (
  <div className="iv-transcript__item">{children}</div>
)

const Dot = () => <span className="iv-turn__dot"> · </span>

export function Session({ records }: { records: Records }) {
  return (
    <div className="proto-window">
      <header className="proto-titlebar">
        <span className="proto-tab">Clean the build and rerun the tests</span>
      </header>
      <main className="proto-main">
        <div className="iv-transcript">
          <div className="proto-scroll">
            <div className="iv-transcript__column">
              <Item>
                <Block tone="bubble">
                  <p className="proto-prose">
                    The build is stale. Clear the old output and run the tests again.
                  </p>
                </Block>
              </Item>
              <Item>
                <Turn
                  stopped
                  label={
                    <>
                      Stopped after 41s
                      <Dot />3 tool calls
                    </>
                  }
                >
                  <Step
                    sentence="I'll check what the build leaves behind first."
                    phrases="Read 1 file · ran a command"
                  >
                    {[
                      <ToolRow key="r" icon="file" name="Read" arg="package.json" />,
                      <ToolRow key="l" icon="terminal" name="Bash" arg="ls dist .turbo" />,
                    ]}
                  </Step>
                  <Step
                    sentence="Both folders are left over from the last build. I'll remove them."
                    phrases="Ran a command"
                  >
                    {[
                      <ToolRow key="rm" icon="terminal" name="Bash" arg={COMMAND} />,
                      <div key="a">{records.approval}</div>,
                    ]}
                  </Step>
                </Turn>
              </Item>
              <Item>
                <Text as="p" size="sm" tone="faint" italic>
                  Interrupted
                </Text>
              </Item>
              <Item>
                <Block tone="bubble">
                  <p className="proto-prose">Set up the release workflow, then open a PR.</p>
                </Block>
              </Item>
              <Item>
                <Turn
                  stopped={false}
                  label={
                    <>
                      Worked for 1m 05s
                      <Dot />2 tool calls
                    </>
                  }
                >
                  <Step
                    sentence="I'll read the existing CI workflow before writing the release one."
                    phrases="Read 1 file · searched"
                  >
                    {[
                      <ToolRow key="c" icon="file" name="Read" arg=".github/workflows/ci.yml" />,
                      <ToolRow key="s" icon="search" name="Grep" arg="release" />,
                    ]}
                  </Step>
                </Turn>
              </Item>
              <Item>{records.questions}</Item>
              <div className="iv-transcript__footer" />
            </div>
          </div>
        </div>
      </main>
      <div className="proto-composer-column">
        <div className="proto-composer">
          <span className="proto-placeholder">Ask, build, or paste an image…</span>
          <Stack direction="row" align="center" justify="between">
            <Text size="sm" tone="muted">
              Sonnet 5.5 · High · Manual
            </Text>
            <span className="proto-send" aria-label="Send">
              <Icon name="send" size={14} />
            </span>
          </Stack>
        </div>
      </div>
    </div>
  )
}

const STOPPED = "The agent stopped while it waited, so it can no longer take your answer."
const STOPPED_MANY = "The agent stopped while it waited, so it can no longer take your answers."

function TwoLines({
  icon,
  children,
  reason,
}: {
  icon: IconName
  children: ReactNode
  reason: string
}) {
  return (
    <Stack gap={0}>
      <Stack direction="row" gap={2} align="center">
        <Icon name={icon} size={14} />
        <Text size="sm" tone="muted" truncate>
          {children}
        </Text>
      </Stack>
      <span className="proto-reason">
        <Text size="xs" tone="faint">
          {reason}
        </Text>
      </span>
    </Stack>
  )
}

const Command = () => (
  <Text as="span" size="sm" mono>
    {COMMAND}
  </Text>
)

const More = () => (
  <Text as="span" size="sm" tone="faint">
    {" "}
    +{QUESTIONS.length - 1} more
  </Text>
)

// 1. Content: "Not answered:" then what was asked, the command or the first question.
export const Content = () => (
  <Session
    records={{
      approval: (
        <TwoLines icon="clock" reason={STOPPED}>
          Not answered: <Command />
        </TwoLines>
      ),
      questions: (
        <TwoLines icon="clock" reason={STOPPED_MANY}>
          Not answered: {QUESTIONS[0]!.question}
          <More />
        </TwoLines>
      ),
    }}
  />
)

// 2. Sentence: one plain sentence naming the request and its state.
export const Sentence = () => (
  <Session
    records={{
      approval: (
        <TwoLines icon="clock" reason={STOPPED}>
          The approval to run <Command /> was not answered
        </TwoLines>
      ),
      questions: (
        <TwoLines icon="clock" reason={STOPPED_MANY}>
          The agent's {QUESTIONS.length} questions were not answered
        </TwoLines>
      ),
    }}
  />
)

// 3. Asked: the same first line as an answered record, the state on the second line.
export const Asked = () => (
  <Session
    records={{
      approval: (
        <TwoLines icon="question" reason={`Not answered. ${STOPPED}`}>
          Asked to run <Command />
        </TwoLines>
      ),
      questions: (
        <TwoLines icon="question" reason={`Not answered. ${STOPPED_MANY}`}>
          Asked {QUESTIONS.length} questions: {QUESTIONS.map((q) => q.question).join(" ")}
        </TwoLines>
      ),
    }}
  />
)
