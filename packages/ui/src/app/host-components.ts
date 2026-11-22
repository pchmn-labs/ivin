import type { HostComponents } from "@ivin/plugin-api/ui"
import { ActionSheet } from "../core/components/action-sheet/action-sheet.tsx"
import { Block } from "../core/components/block/block.tsx"
import { Button, IconButton } from "../core/components/button/button.tsx"
import { CodeBlock } from "../core/components/code-block/code-block.tsx"
import { Dialog } from "../core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../core/components/error-message/error-message.tsx"
import { Disclosure } from "../core/components/disclosure/disclosure.tsx"
import { Icon } from "../core/components/icon/icon.tsx"
import { Menu } from "../core/components/menu/menu.tsx"
import { OptionList } from "../core/components/option-list/option-list.tsx"
import { Stack } from "../core/components/stack/stack.tsx"
import { StatusMark } from "../core/components/status-mark/status-mark.tsx"
import { Text } from "../core/components/text/text.tsx"
import { Tooltip } from "../core/components/tooltip/tooltip.tsx"
import { Tree } from "../core/components/tree/tree.tsx"
import { QuickPick } from "../core/components/quick-pick/quick-pick.tsx"
import { SearchField } from "../core/components/search-field/search-field.tsx"
import { ListRow } from "../core/components/list-row/list-row.tsx"
import { ListSection } from "../core/components/list-section/list-section.tsx"
import { SessionMarkdown } from "../modules/file/ui/session-markdown.tsx"
import { ProjectCreature } from "../modules/project/ui/project-creature.tsx"
import { RelativeTime } from "../modules/session/ui/relative-time.tsx"
import { SessionMark } from "../modules/session/ui/session-mark.tsx"
import { MessageImages } from "../modules/transcript/ui/message-images.tsx"
import { MessageText } from "../modules/transcript/ui/message-text.tsx"

export const hostComponents = {
  Button,
  IconButton,
  Icon,
  Menu,
  Dialog,
  Tooltip,
  Text,
  Stack,
  Block,
  Disclosure,
  CodeBlock,
  StatusMark,
  Markdown: SessionMarkdown,
  ActionSheet,
  OptionList,
  ErrorMessage,
  ListRow,
  ListSection,
  SessionMark,
  RelativeTime,
  ProjectMark: ProjectCreature,
  MessageImages,
  MessageText,
  Tree,
  SearchField,
  QuickPick,
} satisfies HostComponents
