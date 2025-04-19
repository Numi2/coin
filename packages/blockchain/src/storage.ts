import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Block } from './models/Block';
import type { Transaction } from './models/Transaction';

/** IndexedDB schema for persisting blockchain data */
interface ChainDB extends DBSchema {
  blocks: {
    key: number;
    value: Block;
  };
  mempool: {
    key: string;
    value: Transaction;
  };
}

/** Persistence adapter interface for chain and mempool */
export interface PersistenceAdapter {
  /** Load the persisted chain (blocks) */
  loadChain(): Promise<Block[]>;
  /** Save the provided chain (blocks) */
  saveChain(blocks: Block[]): Promise<void>;
  /** Load the persisted mempool */
  loadMempool(): Promise<Transaction[]>;
  /** Save the provided mempool */
  saveMempool(txs: Transaction[]): Promise<void>;
}

/** IndexedDB-based adapter for storing chain and mempool using idb */
export class IndexedDBAdapter implements PersistenceAdapter {
  private dbPromise: Promise<IDBPDatabase<ChainDB>>;

  constructor(dbName = 'coin-chain', version = 1) {
    this.dbPromise = openDB<ChainDB>(dbName, version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('blocks')) {
          db.createObjectStore('blocks');
        }
        if (!db.objectStoreNames.contains('mempool')) {
          db.createObjectStore('mempool');
        }
      },
    });
  }

  async loadChain(): Promise<Block[]> {
    const db = await this.dbPromise;
    const tx = db.transaction('blocks', 'readonly');
    const store = tx.objectStore('blocks');
    const keys = await store.getAllKeys();
    const blocks: Block[] = [];
    for (const key of (keys as number[]).sort((a, b) => a - b)) {
      const block = await store.get(key);
      if (block) {
        blocks.push(block);
      }
    }
    await tx.done;
    return blocks;
  }

  async saveChain(blocks: Block[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('blocks', 'readwrite');
    const store = tx.objectStore('blocks');
    await store.clear();
    for (let i = 0; i < blocks.length; i++) {
      await store.put(blocks[i], i);
    }
    await tx.done;
  }

  async loadMempool(): Promise<Transaction[]> {
    const db = await this.dbPromise;
    const tx = db.transaction('mempool', 'readonly');
    const store = tx.objectStore('mempool');
    const keys = await store.getAllKeys();
    const txs: Transaction[] = [];
    for (const key of (keys as string[])) {
      const txObj = await store.get(key);
      if (txObj) {
        txs.push(txObj);
      }
    }
    await tx.done;
    return txs;
  }

  async saveMempool(txs: Transaction[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction('mempool', 'readwrite');
    const store = tx.objectStore('mempool');
    await store.clear();
    for (let i = 0; i < txs.length; i++) {
      await store.put(txs[i], i.toString());
    }
    await tx.done;
  }
}