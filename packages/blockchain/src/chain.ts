import { Block, createGenesisBlock } from "./models/Block";
import type { Transaction } from "./models/Transaction";
import { mineBlock, adjustDifficulty, validateBlock } from "./miner";
import { Tokenomics, TokenomicsConfig } from "@coin/tokenomics";
import { PersistenceAdapter, IndexedDBAdapter } from "./storage";

/**
 * In-memory blockchain with PoW, block rewards, and a mempool.
 */
export class Chain {
  private chain: Block[];
  private mempool: Transaction[];
  private tokenomics: Tokenomics;
  private targetBlockTime: number;

  constructor(options?: { tokenomicsConfig?: Partial<TokenomicsConfig>; targetBlockTime?: number }) {
    this.tokenomics = new Tokenomics(options?.tokenomicsConfig);
    this.targetBlockTime = options?.targetBlockTime ?? 12;
    const genesis = createGenesisBlock();
    this.chain = [genesis];
    this.mempool = [];
  }

  /** Returns the full chain of blocks. */
  getBlocks(): Block[] {
    return [...this.chain];
  }

  /** Returns the latest block (tip). */
  getTip(): Block {
    return this.chain[this.chain.length - 1];
  }

  /** Returns the current block height (genesis = 0). */
  getHeight(): number {
    return this.chain.length - 1;
  }

  /** Returns pending transactions in the mempool. */
  getPendingTransactions(): Transaction[] {
    return [...this.mempool];
  }

  /** Compute the balance for a given address by scanning all transactions. */
  getBalance(address: string): bigint {
    let balance = 0n;
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        // Subtract sent amounts and fees (skip coinbase)
        if (tx.from && tx.from === address) {
          balance -= tx.amount + tx.fee;
        }
        // Add received amounts
        if (tx.to === address) {
          balance += tx.amount;
        }
      }
    }
    return balance;
  }

  /**
   * Add a new transaction to the mempool after basic validation.
   * Throws on invalid tx.
   */
  addTransaction(tx: Transaction): void {
    if (!tx.from) {
      throw new Error("Mempool transactions must have a sender");
    }
    if (tx.amount <= 0n) {
      throw new Error("Transaction amount must be positive");
    }
    if (tx.fee < 0n) {
      throw new Error("Transaction fee must be non-negative");
    }
    if (this.getBalance(tx.from) < tx.amount + tx.fee) {
      throw new Error("Insufficient balance");
    }
    this.mempool.push(tx);
  }

  /**
   * Mine a new block including a coinbase reward transaction.
   * Clears the mempool on success.
   */
  minePendingTransactions(minerAddress: string): Block {
    const lastBlock = this.getTip();
    const prevBlock = this.chain.length > 1 ? this.chain[this.chain.length - 2] : lastBlock;
    const nextHeight = this.getHeight() + 1;
    const blockReward = this.tokenomics.getBlockReward(nextHeight);
    const feeTotal = this.mempool.reduce((sum, tx) => sum + tx.fee, 0n);
    // Create coinbase tx
    const coinbaseTx: Transaction = {
      from: "",
      to: minerAddress,
      amount: blockReward + feeTotal,
      fee: 0n,
      timestamp: Date.now(),
      signature: ""
    };
    const txs = [coinbaseTx, ...this.mempool];
    const difficulty =
      this.chain.length > 1
        ? adjustDifficulty(prevBlock, lastBlock, this.targetBlockTime)
        : lastBlock.header.difficulty;
    const newBlock = mineBlock(lastBlock, txs, difficulty);
    if (!validateBlock(newBlock)) {
      throw new Error("Mined block is invalid");
    }
    this.chain.push(newBlock);
    this.mempool = [];
    return newBlock;
  }

  /**
   * Validate the entire chain: link hashes, PoW, and merkle roots.
   */
  validateChain(): boolean {
    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];
      if (!validateBlock(block)) {
        return false;
      }
      if (i > 0) {
        const prev = this.chain[i - 1];
        if (block.header.previousHash !== prev.hash) {
          return false;
        }
      }
    }
    return true;
  }
  /**
   * Apply an externally mined block (from peer) to the chain if valid.
   * @param block The block received from a peer.
   * @returns True if the block was appended, false otherwise.
   */
  applyBlock(block: Block): boolean {
    const tip = this.getTip();
    if (block.header.previousHash !== tip.hash) {
      return false;
    }
    if (!validateBlock(block)) {
      return false;
    }
    this.chain.push(block);
    return true;
  }
}

/**
 * PersistentChain wraps Chain with automatic persistence to a PersistenceAdapter.
 */
export class PersistentChain extends Chain {
  private storage: PersistenceAdapter;

  private constructor(
    storageAdapter: PersistenceAdapter,
    options?: { tokenomicsConfig?: Partial<TokenomicsConfig>; targetBlockTime?: number }
  ) {
    super(options);
    this.storage = storageAdapter;
  }

  /**
   * Create a PersistentChain and load persisted data if available.
   */
  static async create(
    options?: {
      tokenomicsConfig?: Partial<TokenomicsConfig>;
      targetBlockTime?: number;
      storageAdapter?: PersistenceAdapter;
    }
  ): Promise<PersistentChain> {
    const storage = options?.storageAdapter ?? new IndexedDBAdapter();
    const chain = new PersistentChain(
      storage,
      {
        tokenomicsConfig: options?.tokenomicsConfig,
        targetBlockTime: options?.targetBlockTime,
      }
    );
    const persisted = await storage.loadChain();
    if (persisted.length > 0) {
      (chain as any).chain = persisted;
    }
    const mempool = await storage.loadMempool();
    if (mempool.length > 0) {
      (chain as any).mempool = mempool;
    }
    return chain;
  }

  /** Add transaction and persist mempool. */
  async addTransaction(tx: Transaction): Promise<void> {
    super.addTransaction(tx);
    await this.storage.saveMempool(this.getPendingTransactions());
  }

  /** Mine and persist chain and mempool. */
  async minePendingTransactions(minerAddress: string): Promise<Block> {
    const block = super.minePendingTransactions(minerAddress);
    await this.storage.saveChain(this.getBlocks());
    await this.storage.saveMempool(this.getPendingTransactions());
    return block;
  }
  /**
   * Apply an externally mined block and persist the updated chain.
   * @param block The block received from a peer.
   * @returns True if the block was appended, false otherwise.
   */
  async applyBlock(block: Block): Promise<boolean> {
    const ok = super.applyBlock(block);
    if (ok) {
      await this.storage.saveChain(this.getBlocks());
    }
    return ok;
  }
}