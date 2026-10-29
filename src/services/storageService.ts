import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Sequential write queue to serialize storage writes per key.
 * This completely prevents async race conditions where an earlier write finishes
 * after a later write and clobbers newer data.
 */
const writeQueues = new Map<string, Promise<void>>();

export async function getJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`[storageService] Failed to read key "${key}":`, error);
    return fallback;
  }
}

export async function getOptionalJson<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.warn(`[storageService] Failed to read optional key "${key}":`, error);
    return null;
  }
}

export async function setJson<T>(key: string, value: T): Promise<void> {
  const currentQueue = writeQueues.get(key) ?? Promise.resolve();

  const nextWrite = currentQueue
    .catch(() => {
      // Continue queue even if a previous write failed
    })
    .then(async () => {
      const serialized = JSON.stringify(value);
      await AsyncStorage.setItem(key, serialized);
    });

  writeQueues.set(key, nextWrite);

  return nextWrite;
}

export async function removeKey(key: string): Promise<void> {
  const currentQueue = writeQueues.get(key) ?? Promise.resolve();

  const nextOp = currentQueue
    .catch(() => {})
    .then(async () => {
      await AsyncStorage.removeItem(key);
    });

  writeQueues.set(key, nextOp);

  return nextOp;
}
