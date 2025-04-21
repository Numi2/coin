export interface Header {
  previousHash: string;
  merkleRoot: string;
  timestamp: number;
  nonce: number;
  difficulty: bigint;
}

import { hash } from '@c4312/blake3-wasm';

/**
 * Hash a block header using Blake3 and return raw bytes.
 */
export function hashHeader(header: Header): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(
    `${header.previousHash}|${header.merkleRoot}|${header.timestamp}|${header.nonce}|${header.difficulty.toString()}`
  );
  return hash(data);
}
