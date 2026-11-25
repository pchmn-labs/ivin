# A session on several project folders runs in a folder ivin creates, with one worktree per project folder

A project opened from a `.code-workspace` has several project folders, each its own git repository. A session's first message creates a working folder under `~/.ivin/worktrees/<workspace name>/<branch>/` holding one worktree per project folder, all on the same branch name, and the agent starts there. No project folder is the main one, and one turn can change every repository. The folder is in ivin's own data folder because a workspace has no single folder to hold it and nothing should be written beside the user's files.

## Considered options

- **One main project folder, the others given to the agent as extra directories**: rejected. The main folder is arbitrary, and the other folders get no branch or worktree of their own in the session, so a change made there lands on their checkout.
- **Worktrees next to the `.code-workspace` file, or in each project folder's `.worktrees/`**: rejected. The folders can be anywhere on disk, and the session's worktrees would be scattered.

## Consequences

- The working folder is not a git repository: branches, worktrees and changes are read per repository, never for the working folder itself.
- The trust check must accept the working folder, which is neither under a trusted project folder nor a worktree git lists for one.
- A repository that refers to a sibling by relative path can break inside the working folder.
