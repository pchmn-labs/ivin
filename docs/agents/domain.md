# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: the ADRs that touch the area you're about to work in.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## When a change runs into an ADR

Sort the collision before you raise it:

- **It reverses the decision**, or brings back an option the ADR rejected: surface it before writing code, and wait for the user.

  > _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

- **It extends what the ADR describes** (one more case, one more entry in a list the ADR spells out) and the user asked for it: the request is the new decision. Rewrite the ADR in the same change, per `/domain-modeling`'s ADR format, and name it in one line of your reply.
- **Your own choice would break it**, with nothing in the request asking for that: follow the ADR, or ask.
- **What it rests on has changed**: its **Revisit if** line is met, or a fact it states no longer holds. Surface it like a reversal, naming what changed.
