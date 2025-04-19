declare module 'blake3' {
  /**
   * Computes the BLAKE3 hash of the input bytes.
   * @param input - data to hash
   * @returns 32-byte hash
   */
  export function hash(input: Uint8Array): Uint8Array;
}