import { keyPair, sign as dilithiumSign, verify as dilithiumVerify } from 'dilithium-js';

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

/** Generate a new CRYSTALS-Dilithium key pair. */
export function generateKeyPair(): KeyPair {
  const { publicKey, secretKey } = keyPair();
  return {
    publicKey: bytesToHex(publicKey),
    privateKey: bytesToHex(secretKey)
  };
}

/** Sign data (Uint8Array) returning a hex-encoded signature. */
export function sign(data: Uint8Array, privateKeyHex: string): string {
  const privateKey = hexToBytes(privateKeyHex);
  const signature = dilithiumSign(data, privateKey);
  return bytesToHex(signature);
}

/** Verify a hex-encoded signature against the data and public key. */
export function verify(data: Uint8Array, signatureHex: string, publicKeyHex: string): boolean {
  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(publicKeyHex);
  return dilithiumVerify(data, signature, publicKey);
}
