import { hash } from 'blake3';
import { bytesToHex } from '../utils';

export interface Transaction {
  from: string;
  to: string;
  amount: bigint;
  fee: bigint;
  timestamp: number;
  signature: string;
}

/**
 * Compute the hash of a transaction by serializing its fields and hashing with BLAKE3.
 * Returns a hex-encoded digest.
 */
export function calculateTransactionHash(tx: Transaction): string {
  const encoder = new TextEncoder();
  const serialized = `${tx.from}|${tx.to}|${tx.amount.toString()}|${tx.fee.toString()}|${tx.timestamp}|${tx.signature}`;
  const data = encoder.encode(serialized);
  const digest = hash(data);
  return bytesToHex(digest);
}
