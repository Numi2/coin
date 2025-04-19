import { Header, hashHeader } from "./models/Header";
import { Block } from "./models/Block";
import { Transaction, calculateTransactionHash } from "./models/Transaction";
import { bytesToHex, computeMerkleRoot, bytesToBigInt } from "./utils";

/**
 * Mine a new block by finding a nonce such that the header hash is below the target difficulty.
 * @param previousBlock The previous block in the chain (or genesis).
 * @param transactions The list of transactions to include in the new block.
 * @param difficulty The target difficulty as a bigint (headerHash < difficulty).
 * @returns A newly mined Block with valid nonce and hash.
 */
export function mineBlock(
  previousBlock: Block,
  transactions: Transaction[],
  difficulty: bigint
): Block {
  // Initialize header
  const header: Header = {
    previousHash: previousBlock.hash,
    merkleRoot: computeMerkleRoot(
      transactions.map((tx) => calculateTransactionHash(tx))
    ),
    timestamp: Date.now(),
    nonce: 0,
    difficulty,
  };

  while (true) {
    // Hash header and interpret as bigint
    const hashBytes = hashHeader(header);
    const hashInt = bytesToBigInt(hashBytes);
    if (hashInt < difficulty) {
      // Found a valid nonce
      return {
        header,
        transactions,
        hash: bytesToHex(hashBytes),
      };
    }
    header.nonce++;
  }
}

/**
 * Adjust difficulty based on time taken to mine last block.
 * @param previousBlock The block before the last block.
 * @param lastBlock The most recently mined block.
 * @param targetBlockTime Desired block interval in seconds.
 * @returns New difficulty as bigint.
 */
export function adjustDifficulty(
  previousBlock: Block,
  lastBlock: Block,
  targetBlockTime: number
): bigint {
  const timeTakenMs = BigInt(
    lastBlock.header.timestamp - previousBlock.header.timestamp
  );
  const targetMs = BigInt(targetBlockTime) * 1000n;
  const prevDiff = lastBlock.header.difficulty;
  // Scale difficulty proportionally: newDiff = prevDiff * (timeTaken / target)
  let newDiff = (prevDiff * timeTakenMs) / targetMs;
  if (newDiff < 1n) {
    newDiff = 1n;
  }
  return newDiff;
}

/**
 * Validate that a block is correctly mined and its contents are consistent.
 * @param block The block to validate.
 * @returns True if valid, false otherwise.
 */
export function validateBlock(block: Block): boolean {
  // Recompute header hash
  const headerHashBytes = hashHeader(block.header);
  const headerHashHex = bytesToHex(headerHashBytes);
  if (headerHashHex !== block.hash) {
    return false;
  }
  // Check proof-of-work
  const hashInt = bytesToBigInt(headerHashBytes);
  if (hashInt >= block.header.difficulty) {
    return false;
  }
  // Verify merkle root
  const computedRoot = computeMerkleRoot(
    block.transactions.map((tx) => calculateTransactionHash(tx))
  );
  if (computedRoot !== block.header.merkleRoot) {
    return false;
  }
  return true;
}