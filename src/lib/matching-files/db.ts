import { UploadedFile, ParsedFileData } from './types';

const DB_NAME = 'LunarMatchingFilesDB';
const DB_VERSION = 1;
const STORE_FILES = 'files_metadata';
const STORE_DATA = 'files_data';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => reject((e.target as any).error);

    request.onsuccess = (e) => resolve((e.target as any).result);

    request.onupgradeneeded = (e) => {
      const db = (e.target as any).result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA, { keyPath: 'fileId' });
      }
    };
  });

  return dbPromise;
}

export async function saveFileMetadata(file: UploadedFile): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readwrite');
    const store = tx.objectStore(STORE_FILES);
    const req = store.put(file);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as any).error);
  });
}

export async function getFilesMetadata(): Promise<UploadedFile[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FILES, 'readonly');
    const store = tx.objectStore(STORE_FILES);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject((e.target as any).error);
  });
}

export async function deleteFileDB(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_FILES, STORE_DATA], 'readwrite');
    tx.objectStore(STORE_FILES).delete(id);
    tx.objectStore(STORE_DATA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as any).error);
  });
}

export async function saveParsedData(data: ParsedFileData): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readwrite');
    const store = tx.objectStore(STORE_DATA);
    const req = store.put(data);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject((e.target as any).error);
  });
}

export async function getParsedData(fileId: string): Promise<ParsedFileData | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_DATA, 'readonly');
    const store = tx.objectStore(STORE_DATA);
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject((e.target as any).error);
  });
}

export async function clearAllDB(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_FILES, STORE_DATA], 'readwrite');
    tx.objectStore(STORE_FILES).clear();
    tx.objectStore(STORE_DATA).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject((e.target as any).error);
  });
}
