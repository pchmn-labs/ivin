// What a command's handler throws when it fails and its failure has no place on screen.
export class CommandFailure extends Error {
  constructor(
    message: string,
    readonly retry?: () => void,
  ) {
    super(message)
  }
}
