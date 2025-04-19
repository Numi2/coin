import { hash } from 'blake3';

/** Convert a Uint8Array to a hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Convert a hex string to a Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/** Convert a Uint8Array to a BigInt. */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const b of bytes) {
    result = (result << 8n) + BigInt(b);
  }
  return result;
}

/** Compute the Merkle root of a list of hex-encoded hashes. */
export function computeMerkleRoot(hashes: string[]): string {
  if (hashes.length === 0) {
    return '0'.repeat(64);
  }
  // Convert hex hashes to byte arrays
  let nodes: Uint8Array[] = hashes.map(hexToBytes);
  // Iteratively compute parent nodes
  while (nodes.length > 1) {
    const nextLevel: Uint8Array[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : left;
      const data = new Uint8Array(left.length + right.length);
      data.set(left, 0);
      data.set(right, left.length);
      nextLevel.push(hash(data));
    }
    nodes = nextLevel;
  }
  return bytesToHex(nodes[0]);
}