# The UI writes the error messages users read, and the server writes raw errors to a log file

The server fails with typed errors declared in `contracts`, never with text meant for the user. For each action, the UI turns each error type into a message, and gives an error it does not know the action's own message ("The message was not sent. Retry?"). A failure shows next to where the user acted, a failure of the whole app (losing the server) in the window shell, and a failure with no place on screen, such as a command run from a keybinding on something hidden, as a temporary notification in a corner of the window.

The raw error never reaches the screen. The server writes it, one JSON line per error and with no rotation for now, to `~/.ivin/logs/ivin.log`; the UI sends its own errors to the server for the same file, and `ivin logs` prints it, so the agent debugging ivin can read it. A plugin's errors stay in `ivin plugin logs <id>`. An error the harness reports inside a session is part of the transcript and is shown as the harness wrote it.

## Considered options

- **The server sends the message to show**: rejected because the wording would then be split between the server and the UI, and the server would carry text that depends on the screen.
- **Raw errors in the console only**: rejected because an agent cannot read the renderer's DevTools console.
