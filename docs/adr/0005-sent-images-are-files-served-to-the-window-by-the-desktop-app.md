# Sent images are files beside the database, served to the window by the desktop app

The images a user sends are files in an `images` folder beside the database: one folder per session, one file per image, named after the image's id with its type's extension. A row per image in SQLite keeps its session and its number, so the numbers stay unique in a session and the row goes in the same transaction as the session's other rows when it is deleted; the session's folder goes right after. The server writes the files; the desktop app serves them to the window through an `ivin-image://<session>/<image>.<ext>` protocol, so an `<img>` loads its file directly and the window decodes and caches it. At start, the server deletes the folder of any session that no longer exists, which a crash between the rows and the folder would leave behind.

When a session's last tab closes, the server re-encodes its PNG and JPEG images as WebP at their own size, and keeps the WebP when it is smaller. The row records the type of the stored file, and the server gives that type to every image reference it sends, so the window builds the file's URL from it; the events keep the type the image was sent with. The encoding runs in a worker thread with WebAssembly codecs, because a large screenshot takes most of a second to encode and the server answers every RPC on one thread.

## Considered options

- **The bytes in SQLite, as blobs, fetched over the RPC**: rejected because the database would grow with every screenshot and not shrink without `VACUUM`, and each image would cross the RPC in base64, a third larger, then stay in the window's memory as a `data:` URL.
- **Compressing when a session is archived, or right after sending**: rejected because users rarely archive, and the session in use would show degraded images.
- **Rewriting the events with the compressed type**: rejected because events record what was sent and are never rewritten.
- **`sharp` for the encoding**: rejected because it is a native module that packaging must ship for each platform; Electron's `nativeImage` encodes no WebP and does not exist in the server's utility process.
- **The bytes as files with no row**: rejected because the session's numbers would then come from scanning its events, with nothing to keep two images from taking the same number.
