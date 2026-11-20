import { Context } from "effect"

// Beside the database; the desktop app serves it to the window as `ivin-image://`.
export class ImageFolder extends Context.Service<ImageFolder, { readonly path: string }>()(
  "ivin/server/ImageFolder",
) {}
