# Finished features: what every user-facing feature includes

A feature is finished when its whole path works, not only the path where everything goes right. These rules apply to anything a user sees or triggers. A spec or a ticket answers Keyboard, Errors and States below, and its "Done when" checks the answers.

## Keyboard

- Every action a user repeats has a shortcut, and every action can be reached without the mouse.
- A shortcut has a command id, such as `session.interrupt` for Escape, so the user can change its key in `~/.ivin/keybindings.json` (see [the architecture](architecture.md#files)) once the app reads that file.
- A shortcut does nothing when the event was already handled (`defaultPrevented`) or when a text field needs the key.
- `⌘` on macOS, `Ctrl` elsewhere.
- A button or menu item with a shortcut shows it in its tooltip or menu row.
- Focus is always visible, and lands somewhere useful after a dialog, a menu or a panel opens or closes.

## Errors

- The spec lists how each action can fail: the server is unreachable, the harness exits, a file is missing or invalid, a git command fails…
- A failure shows where the user acted: under the message field for a message that could not be sent, on the session row for a failed session. Only failures of the whole app, such as losing the server, show in the window shell. A failure with no place on screen shows as a temporary notification.
- The message says what failed and what the user can do next, in the glossary's words: "The message was not sent. Check that Claude Code is installed, then retry." Never "Something went wrong", never the raw error, which is logged instead.
- A failure keeps what the user typed or chose.
- A failure that a second try can fix offers a retry.
- Nothing fails silently, including work that runs in the background.

## States

Besides the normal case, each screen handles:

- **loading**, shown only when it lasts long enough to notice;
- **empty**, with the next step to take ("No sessions yet", next to the New session button);
- **failed**, as in [Errors](#errors);
- **long content**: long names, many items, text that does not fit.

## Done

- No `TODO`, placeholder text or control that does nothing is merged. What is left for later is a ticket, linked from the pull request.
- The pull request's test plan walks through the keyboard path and at least one failure, not only the normal case.
