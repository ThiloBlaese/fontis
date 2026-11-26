/**
 * Safe storage helper that falls back to an in-memory dictionary
 * if window.localStorage is null, throws an error, or is disabled.
 */

let isNativeStorageFunctional = false;
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const testKey = '__test_storage__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    isNativeStorageFunctional = true;
  }
} catch (e) {
  isNativeStorageFunctional = false;
}

const memoryStore = {};

export const safeStorage = {
  getItem: (key) => {
    if (isNativeStorageFunctional) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {}
    }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  },
  setItem: (key, value) => {
    const strVal = String(value);
    if (isNativeStorageFunctional) {
      try {
        window.localStorage.setItem(key, strVal);
        return;
      } catch (e) {}
    }
    memoryStore[key] = strVal;
  },
  removeItem: (key) => {
    if (isNativeStorageFunctional) {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {}
    }
    delete memoryStore[key];
  },
  clear: () => {
    if (isNativeStorageFunctional) {
      try {
        window.localStorage.clear();
      } catch (e) {}
    }
    for (const k in memoryStore) {
      delete memoryStore[k];
    }
  }
};
