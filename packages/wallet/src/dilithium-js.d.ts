declare module 'dilithium-js' {
  /**
   * Raw key pair bytes from CRYSTALS-Dilithium.
   */
  export interface KeyPairBytes {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  /**
   * Generate a new key pair.
   */
  export function keyPair(): KeyPairBytes;

  /**
   * Sign a message with the secret key, returning a signature.
   */
  export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array;

  /**
   * Verify a signature against a message and public key.
   */
  export function verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
}