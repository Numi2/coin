import type { KeyPair } from "./keys";
import { sign as signHex, verify as verifyHex } from "./keys";

export class Wallet {
  private keys: KeyPair;

  constructor(keys: KeyPair) {
    this.keys = keys;
  }

  /** Sign arbitrary data, returning a hex-encoded signature. */
  sign(data: Uint8Array): string {
    return signHex(data, this.keys.privateKey);
  }

  /** Verify a hex-encoded signature against the data and public key. */
  verify(data: Uint8Array, signature: string, publicKey: string): boolean {
    return verifyHex(data, signature, publicKey);
  }
}

export default Wallet;
