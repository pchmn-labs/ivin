# Inline code opens a relative path only when the working folder lists it

Inline code in an agent's answer became a link to a file when its text had the shape of a path, without a look at the working folder. Text alone cannot tell `origin/main` from `src/main`, or `console.log` from `index.ts`, so a branch, a repository or a property access opened the file view on "no longer exists", and a file without an extension, such as `bin/ivin`, could not be clicked.

Now inline code naming a relative path opens its file only when `file.listFiles` lists it, the working folder's files that git does not ignore. The UI reads that list once per session and again after each batch of `file.watch`, keeping the same list while its paths stay the same. An absolute path or a `file://` URL still opens on its shape, since a file outside the working folder is never listed. While the list loads, a relative path stays code; when the list is truncated or cannot be read, the shape decides. Inline code that is a domain with a common top-level domain (`github.com/pchmn-labs/ivin`) and that the list does not hold opens in the browser as `https://…`.

## Considered options

- **A sharper rule on the text**, such as asking for an extension: rejected because the same text names a file in one folder and a branch in another, so each rule moves the mistakes rather than ending them.
- **Asking the server whether each path exists**: rejected because an answer holds many code spans, and the list the server already keeps for the file search answers them all at once.

## Consequences

- A file git ignores, such as `.env` or a build output, does not open from relative inline code; written as an absolute path, it does.
- A path the agent names before creating the file becomes a link once the file is on disk.
- A file named like a domain with a common top-level domain (`notes.io`) opens as a web page unless the list holds it.
