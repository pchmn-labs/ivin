# Annotation

What the design adds to the [glossary](../../GLOSSARY.md)'s terms in the `annotation` module, on the server and in the UI. The design shared by every module is in [the architecture](README.md).

- An annotation looks like `{ ns: "prs", kind: "pr", data: { url, relation: "created" } }`. This is the generic answer to "link these PRs to this session".
- Annotations are stored in SQLite on a session or a project, and reached through `annotation.add`, `annotation.remove`, `annotation.list` (by target and kind) and `annotation.watch` (by target). The kinds defined in `contracts` (`annotationKinds`) are `pr` (`relation`: `created`, `referenced` or `reviewed`; `title`, `state` and `checks` optional, for the `github` plugin to fill) and `issue` (`created`, `referenced` or `resolved`, when the session's work closes it), both keyed on their `url`, which must be in the form `forgeUrlOf` returns. A defined kind has its `data` checked against its shape, and names the field that is its key: writing the same `ns`, `kind` and key on the same target again updates that annotation. Any other kind has no key, so each write adds one. Deleting a session deletes its annotations.
