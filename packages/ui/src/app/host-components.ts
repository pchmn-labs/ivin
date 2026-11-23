import type { HostComponents } from "@ivin/plugin-api/ui"
import { ActionSheet } from "../core/components/action-sheet/action-sheet.tsx"
import { Block } from "../core/components/block/block.tsx"
import { Button, IconButton } from "../core/components/button/button.tsx"
import { ChangeList } from "../core/components/change-list/change-list.tsx"
import { CodeBlock } from "../core/components/code-block/code-block.tsx"
import { Dialog } from "../core/components/dialog/dialog.tsx"
import { ErrorMessage } from "../core/components/error-message/error-message.tsx"
import { Disclosure } from "../core/components/disclosure/disclosure.tsx"
import { Icon } from "../core/components/icon/icon.tsx"
import { Menu } from "../core/components/menu/menu.tsx"
import { OptionList } from "../core/components/option-list/option-list.tsx"
import { ChoiceList } from "../core/components/choice-list/choice-list.tsx"
import { Steps } from "../core/components/steps/steps.tsx"
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
import { ComposerFrame } from "../modules/session/ui/composer-frame.tsx"
import { MessageField } from "../modules/session/ui/message-field.tsx"
import { PickWorkingFolder } from "../modules/session/ui/pick-working-folder.tsx"
import { RunOptionsMenu } from "../modules/session/ui/run-options-menu.tsx"
import { SessionLocation } from "../modules/session/ui/session-location.tsx"
import { SessionLocationPicker } from "../modules/session/ui/session-location-picker.tsx"
import { HostTextField } from "./host-text-field.tsx"
import { HostSlot } from "./slot-renderer.tsx"
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
  ChoiceList,
  Steps,
  ErrorMessage,
  ListRow,
  ListSection,
  SessionMark,
  RelativeTime,
  ProjectMark: ProjectCreature,
  MessageImages,
  MessageText,
  Tree,
  ChangeList,
  SearchField,
  QuickPick,
  TextField: HostTextField,
  Slot: HostSlot,
  SessionLocation,
  SessionLocationPicker,
  PickWorkingFolder,
  RunOptionsMenu,
  MessageField,
  ComposerFrame,
} satisfies HostComponents
