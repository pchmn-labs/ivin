# Sent images are files beside the database, served to the window by the desktop app

The images a user sends are files in an `images` folder beside the database: one folder per session, one file per image, named after the image's id with its type's extension. A row per image in SQLite keeps its session and its number, so the numbers stay unique in a session and the row goes in the same transaction as the session's other rows when it is deleted; the session's folder goes right after. The server writes the files; the desktop app serves them to the window through an `ivin-image://<session>/<image>.<ext>` protocol, so an `<img>` loads its file directly and the window decodes and caches it. At start, the server deletes the folder of any session that no longer exists, which a crash between the rows and the folder would leave behind.

## Considered options

- **The bytes in SQLite, as blobs, fetched over the RPC**: rejected because the database would grow with every screenshot and not shrink without `VACUUM`, and each image would cross the RPC in base64, a third larger, then stay in the window's memory as a `data:` URL.
- **The bytes as files with no row**: rejected because the session's numbers would then come from scanning its events, with nothing to keep two images from taking the same number.
