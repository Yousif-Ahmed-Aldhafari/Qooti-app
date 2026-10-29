const storage = new Map<string, string>();

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
  },
};

export default AsyncStorage;

