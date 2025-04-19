import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Block, Transaction } from '@coin/blockchain';

interface NodeDB extends DBSchema {
  'node-state': {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'coin-node';
const STORE_NAME = 'node-state';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<NodeDB>>;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<NodeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get a value from IndexedDB by key, returning a default if not found.
 */
export async function getState<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const result = await db.get(STORE_NAME, key);
  return (result === undefined ? defaultValue : (result as T));
}

/**
 * Store a value in IndexedDB under the given key.
 */
export async function setState<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, value, key);
}

/**
 * Retrieve the stored blockchain (array of blocks).
 */
export async function getChain(): Promise<Block[]> {
  return getState<Block[]>('chain', []);
}

/**
 * Persist the blockchain (array of blocks).
 */
export async function setChain(chain: Block[]): Promise<void> {
  await setState<Block[]>('chain', chain);
}

/**
 * Retrieve the stored mempool (array of transactions).
 */
export async function getMempool(): Promise<Transaction[]> {
  return getState<Transaction[]>('mempool', []);
}

/**
 * Persist the mempool (array of transactions).
 */
export async function setMempool(mempool: Transaction[]): Promise<void> {
  await setState<Transaction[]>('mempool', mempool);
}