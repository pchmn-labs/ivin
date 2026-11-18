# Finished features: the level every user-facing feature reaches

A feature ships finished, as it would be for someone who uses ivin all day, not as a demo of the case where everything goes right. The goal is that result; this page only lists what is most often forgotten, and a feature that meets every point but still feels unfinished is not done.

Before calling a feature done, use it as that person would: with the keyboard only, with nothing in it, with far too much in it, with the server gone, with a slow harness. Fix what feels wrong, or open a ticket for it.

## Often forgotten

- **Keyboard.** An action the user repeats has a keybinding to a command, which the user can change ([ADR-0003](adr/0003-keyboard-shortcuts-are-keybindings-to-commands.md)). Focus stays visible and lands somewhere useful after a dialog, a menu or a panel opens or closes.
- **Failures.** A spec or a ticket lists how each action can fail. Each failure shows next to where the user acted, says what failed and what to do next, keeps what the user typed or chose, and offers a retry when a second try can work ([ADR-0004](adr/0004-the-ui-writes-error-messages-and-the-server-logs-raw-errors.md)). Never a raw error, never silence.
- **States.** Loading, empty (with the next step to take), failed, and long content: long names, many items, text that does not fit.
- **Speed.** The feature stays fast with a long transcript, many sessions and an answer streaming in, following [Responsiveness](architecture.md#responsiveness) and [Performance and memory](architecture.md#performance-and-memory). A path that could get slow has a perf test.
- **What the user was doing survives** a session switch or a lost server: a draft, a scroll position, a selection.

## Done

- No `TODO`, placeholder text or control that does nothing is merged. What is left for later is a ticket, linked from the pull request.
- The pull request's test plan is that use of the feature, as described at the top.
