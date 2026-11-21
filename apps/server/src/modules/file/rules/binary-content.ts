const SNIFFED_BYTES = 8000

export const isBinary = (bytes: Uint8Array): boolean => bytes.subarray(0, SNIFFED_BYTES).includes(0)
