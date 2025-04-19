import { hashHeader } from "./Header";
import { bytesToHex } from "../utils";
import type { Header } from "./Header";
import type { Transaction } from "./Transaction";

export interface Block {
  header: Header;
  transactions: Transaction[];
  hash: string;
}

export function createGenesisBlock(): Block {
  const genesisHeader: Header = {
    previousHash: "0".repeat(64),
    merkleRoot: "0".repeat(64),
    timestamp: Date.now(),
    nonce: 0,
    difficulty: BigInt("0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
  };
  // Compute genesis block hash
  const genesisHashBytes = hashHeader(genesisHeader);
  const genesisHash = bytesToHex(genesisHashBytes);
  return {
    header: genesisHeader,
    transactions: [],
    hash: genesisHash
  };
}
