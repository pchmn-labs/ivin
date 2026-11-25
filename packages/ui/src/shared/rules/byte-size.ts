const KIB = 1024
const oneDecimal = (value: number) => value.toFixed(1).replace(/\.0$/, "")

export const byteSize = (bytes: number): string =>
  bytes < KIB
    ? `${bytes} B`
    : bytes < KIB ** 2
      ? `${Math.round(bytes / KIB)} KB`
      : bytes < KIB ** 3
        ? `${oneDecimal(bytes / KIB ** 2)} MB`
        : `${oneDecimal(bytes / KIB ** 3)} GB`
