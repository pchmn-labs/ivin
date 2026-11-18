import type { HostComponents } from "@ivin/plugin-api/ui"
import { Block } from "../core/ui/block/block.tsx"
import { Button, IconButton } from "../core/ui/button/button.tsx"
import { CodeBlock } from "../core/ui/code-block/code-block.tsx"
import { Dialog } from "../core/ui/dialog/dialog.tsx"
import { Disclosure } from "../core/ui/disclosure/disclosure.tsx"
import { Icon } from "../core/ui/icon/icon.tsx"
import { Menu } from "../core/ui/menu/menu.tsx"
import { Stack } from "../core/ui/stack/stack.tsx"
import { StatusMark } from "../core/ui/status-mark/status-mark.tsx"
import { Text } from "../core/ui/text/text.tsx"
import { Tooltip } from "../core/ui/tooltip/tooltip.tsx"
import { Markdown } from "../modules/transcript/ui/markdown.tsx"

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
  Markdown,
} satisfies HostComponents
