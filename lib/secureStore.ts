// Secure storage using Web Crypto and IndexedDB
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface SecureDB extends DBSchema {
  keys: { key: string; value: ArrayBuffer };
  data: { key: string; value: ArrayBuffer };
}

const DB_NAME = 'coin-secure';
const DB_VERSION = 1;
const STORE_KEYS = 'keys';
const STORE_DATA = 'data';

let dbPromise: Promise<IDBPDatabase<SecureDB>>;
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<SecureDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_KEYS)) {
          db.createObjectStore(STORE_KEYS);
        }
        if (!db.objectStoreNames.contains(STORE_DATA)) {
          db.createObjectStore(STORE_DATA);
        }
      },
    });
  }
  return dbPromise;
}

// Generate or retrieve a persistent AES-GCM master key
async function getMasterKey(): Promise<CryptoKey> {
  const db = await getDB();
  const raw = await db.get(STORE_KEYS, 'master');
  if (raw) {
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  await db.put(STORE_KEYS, exported, 'master');
  return key;
}

// Encrypt and store data under given key
export async function storeSecure(key: string, plaintext: string): Promise<void> {
  const enc = new TextEncoder().encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const master = await getMasterKey();
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, master, enc);
  const buf = new Uint8Array(iv.byteLength + cipher.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(cipher), iv.byteLength);
  const db = await getDB();
  await db.put(STORE_DATA, buf.buffer, key);
}

// Retrieve and decrypt data for given key
export async function getSecure(key: string): Promise<string | null> {
  const db = await getDB();
  const data = await db.get(STORE_DATA, key);
  if (!data) return null;
  const buf = new Uint8Array(data);
  const iv = buf.slice(0, 12);
  const cipher = buf.slice(12);
  const master = await getMasterKey();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, master, cipher);
  return new TextDecoder().decode(plain);
}