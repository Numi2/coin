import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { slh_dsa } from '@noble/post-quantum/slh-dsa';

/** Convert a Uint8Array to a hex string. */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Convert a hex string to a Uint8Array. */
function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export interface KeyPair {
  /** Hex-encoded public key */
  publicKey: string;
  /** Hex-encoded private key */
  privateKey: string;
}
/**
 * Supported post-quantum algorithms.
 */
export type PQAlgorithm = 'dilithium' | 'sphincs';

/**
 * Generate a new post-quantum key pair.
 * @param algorithm - The PQ algorithm to use ('dilithium' or 'sphincs').
 */
export function generateKeyPair(
  algorithm: PQAlgorithm = 'dilithium'
): KeyPair {
  switch (algorithm) {
    case 'dilithium': {
      const { publicKey, secretKey } = ml_dsa65.generateKeyPair();
      return {
        publicKey: bytesToHex(publicKey),
        privateKey: bytesToHex(secretKey)
      };
    }
    case 'sphincs': {
      const { publicKey: pub, secretKey: sec } = slh_dsa.generateKeyPair();
      return {
        publicKey: bytesToHex(pub),
        privateKey: bytesToHex(sec)
      };
    }
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}

/**
 * Sign data (Uint8Array) returning a hex-encoded signature.
 * @param data - The message to sign.
 * @param privateKeyHex - Hex-encoded private key.
 * @param algorithm - The PQ algorithm to use ('dilithium' or 'sphincs').
 */
export function sign(
  data: Uint8Array,
  privateKeyHex: string,
  algorithm: PQAlgorithm = 'dilithium'
): string {
  const privateKey = hexToBytes(privateKeyHex);
  let signature: Uint8Array;
  switch (algorithm) {
    case 'dilithium':
      signature = ml_dsa65.sign(data, privateKey);
      break;
    case 'sphincs':
      signature = slh_dsa.sign(data, privateKey);
      break;
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
  return bytesToHex(signature);
}

/**
 * Verify a hex-encoded signature against the data and public key.
 * @param data - The original message.
 * @param signatureHex - Hex-encoded signature.
 * @param publicKeyHex - Hex-encoded public key.
 * @param algorithm - The PQ algorithm to use ('dilithium' or 'sphincs').
 */
export function verify(
  data: Uint8Array,
  signatureHex: string,
  publicKeyHex: string,
  algorithm: PQAlgorithm = 'dilithium'
): boolean {
  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(publicKeyHex);
  switch (algorithm) {
    case 'dilithium':
      return ml_dsa65.verify(data, signature, publicKey);
    case 'sphincs':
      return slh_dsa.verify(data, signature, publicKey);
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}
