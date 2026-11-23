export class CommandFailure extends Error {
  constructor(
    message: string,
    readonly retry?: () => void,
  ) {
    super(message)
  }
}
