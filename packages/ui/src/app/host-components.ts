import type { HostComponents } from "@ivin/plugin-api/ui"
import { Block } from "../core/components/block/block.tsx"
import { Button, IconButton } from "../core/components/button/button.tsx"
import { CodeBlock } from "../core/components/code-block/code-block.tsx"
import { Dialog } from "../core/components/dialog/dialog.tsx"
import { Disclosure } from "../core/components/disclosure/disclosure.tsx"
import { Icon } from "../core/components/icon/icon.tsx"
import { Menu } from "../core/components/menu/menu.tsx"
import { Stack } from "../core/components/stack/stack.tsx"
import { StatusMark } from "../core/components/status-mark/status-mark.tsx"
import { Text } from "../core/components/text/text.tsx"
import { Tooltip } from "../core/components/tooltip/tooltip.tsx"
import { Markdown } from "../core/components/markdown/markdown.tsx"

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
