import type { HostComponents } from "@ivin/plugin-api/ui"
import { Block } from "../core/design/block.tsx"
import { Button, IconButton } from "../core/design/button.tsx"
import { CodeBlock } from "../core/design/code-block.tsx"
import { Dialog } from "../core/design/dialog.tsx"
import { Disclosure } from "../core/design/disclosure.tsx"
import { Icon } from "../core/design/icon.tsx"
import { Menu } from "../core/design/menu.tsx"
import { Stack } from "../core/design/stack.tsx"
import { StatusMark } from "../core/design/status-mark.tsx"
import { Text } from "../core/design/text.tsx"
import { Tooltip } from "../core/design/tooltip.tsx"
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
