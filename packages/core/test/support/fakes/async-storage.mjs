// A stand-in for @react-native-async-storage/async-storage. Uninstalling an app wipes it.
const store = new Map();
let fault = null;
let missing = false;

export const __store = store;
export function __reset() {
  store.clear();
  fault = null;
  missing = false;
}
/** Simulates an uninstall: app data is gone. */
export function __wipe() {
  store.clear();
}
export function __setFault(fn) {
  fault = fn;
}
/** Simulates a binary that does not link the native module: every call throws. */
export function __setMissing(value) {
  missing = value;
}

function guard(op, key) {
  if (missing) {
    throw new Error('[@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.');
  }
  fault?.(op, key);
}

const AsyncStorage = {
  async getItem(key) {
    guard('get', key);
    return store.has(key) ? store.get(key) : null;
  },
  async setItem(key, value) {
    guard('set', key);
    store.set(key, String(value));
  },
  async removeItem(key) {
    guard('delete', key);
    store.delete(key);
  },
  async getAllKeys() {
    guard('keys', '');
    return [...store.keys()];
  },
};

export default AsyncStorage;
