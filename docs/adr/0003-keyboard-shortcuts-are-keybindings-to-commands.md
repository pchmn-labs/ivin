# Keyboard shortcuts are keybindings that map a key to a command, in a file the user edits

Every action a shortcut can trigger is a command: an id such as `session.interrupt`, a title, and the code that runs it. A keybinding maps a key to a command id, optionally in a named area of the window (`composer`, `sessionList`); with no area it applies everywhere, and when several apply, the one whose area is closest to the focus wins. The core and the plugins declare commands and default keybindings, and `~/.ivin/keybindings.json`, watched by the server, changes them:

```json
[
  { "key": "mod+\\", "command": "sidebar.toggle" },
  { "key": "enter", "command": "-composer.send", "when": "composer" },
  { "key": "mod+enter", "command": "composer.send", "when": "composer" }
]
```

`mod` is ⌘ on macOS and Ctrl elsewhere. A `-` before the command id removes the default keybinding of that command on that key. When two keybindings take the same key in the same area, the user's wins over the default and the conflict is logged. A key may be a sequence of two keys (`mod+k mod+s`) in the file's format, though the app does not handle sequences yet.

A key that acts on the app is a command; a key that moves inside one control (arrows and Enter in a menu or a list, Shift+Enter for a new line, Escape to close a menu) stays in that control and cannot be rebound. The file tree is the exception, as users bring their editor's explorer keys to it: its moves, its Shift selection and Enter are commands in the `tree` area (`tree.focusNext`, `tree.expandOrEnter`, `tree.selectNext`…), and only typing a name to jump to a row stays in it ([ADR-0007](0007-the-file-tree-is-headless-tree-on-tanstack-virtual.md)).

## Considered options

- **A shortcut holding its own code**, with no separate command: rejected because the command palette, `ivin run` and other plugins (`ctx.commands.run`) need to run the same action without a key.
- **Conditions over the app's state, as in VS Code** (`composerFocus && !menuOpen`): not built yet. An area name is a valid condition, so `when` can later accept conditions without breaking existing files.
