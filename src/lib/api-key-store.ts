/**
 * IndexedDB store for the Strum Machine API key.
 * Database: jam-genie, store: settings, key: strumMachineApiKey
 */

const DB_NAME = 'jam-genie';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const API_KEY_KEY = 'strumMachineApiKey';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function getApiKey(): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(API_KEY_KEY);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      const value = req.result;
      resolve(typeof value === 'string' ? value : null);
    };
  });
}

export async function setApiKey(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(key, API_KEY_KEY);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}

export async function clearApiKey(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(API_KEY_KEY);
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
    req.onsuccess = () => {
      db.close();
      resolve();
    };
  });
}

/** Returns a getToken function for StrumMachineClient. Uses stored key or empty string. */
export function createGetToken(): () => Promise<string> {
  return () => getApiKey().then((key) => key ?? '');
}
