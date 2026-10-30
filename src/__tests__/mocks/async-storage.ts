import { resetDatabaseState } from './expo-sqlite';

const storage: Map<string, string> =
  (globalThis as any).__mockAsyncStorageMap || new Map<string, string>();
(globalThis as any).__mockAsyncStorageMap = storage;

const AsyncStorage = {
  getItem: async (key: string) => storage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: async (key: string) => {
    storage.delete(key);
  },
  clear: async () => {
    storage.clear();
    await resetDatabaseState();
  },
};

export default AsyncStorage;
