# Finished features

A feature ships finished, as it would be for someone who uses ivin all day, not as a demo of the case where everything goes right. The bar is that result, not this page: the points below are the ones most often forgotten, and a feature that meets them all but still feels unfinished is not done.

Before calling a feature done, use it as that person would: with the keyboard only, with nothing in it, with far too much in it, with the server gone, with a slow harness. Fix what feels wrong, or open a ticket for it.

## Often forgotten

- **Keyboard.** An action the user repeats has a keybinding to a command, which the user can change (ADR-0003). Focus stays visible and lands somewhere useful after a dialog, a menu or a panel opens or closes.
- **Failures.** Each way an action can fail shows next to where the user acted, says what failed and what to do next, keeps what the user typed, and offers a retry when a second try can work (ADR-0004). Never a raw error, never silence.
- **States.** Loading, empty (with the next step to take), failed, and long content: long names, many items, text that does not fit.
- **Speed.** The feature stays fast with a long transcript, many sessions and an answer streaming in, following [Responsiveness](architecture.md#responsiveness) and [Performance and memory](architecture.md#performance-and-memory). A path that could get slow has a perf test.
- **What the user was doing survives** a session switch, a restart or a lost server: a draft, a scroll position, a selection.

## Done

- No `TODO`, placeholder text or control that does nothing is merged. What is left for later is a ticket, linked from the pull request.
- The pull request's test plan walks through the feature as a daily user would, the keyboard and at least one failure included.
