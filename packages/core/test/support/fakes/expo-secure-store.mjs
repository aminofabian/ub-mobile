// A stand-in for expo-secure-store. It survives resetAsyncStorage() on purpose: on iOS the
// keychain outlives an uninstall, and the reinstall tests depend on that.
const store = new Map();
let fault = null;

const KEY = /^[\w.-]+$/;

function assertKey(key) {
  if (typeof key !== 'string' || !KEY.test(key)) {
    throw new Error(
      'Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".',
    );
  }
}

export const __store = store;
export function __reset() {
  store.clear();
  fault = null;
}
/** fn(op, key) is called before every operation and may throw to simulate a failure. */
export function __setFault(fn) {
  fault = fn;
}

export async function getItemAsync(key) {
  assertKey(key);
  fault?.('get', key);
  return store.has(key) ? store.get(key) : null;
}

export async function setItemAsync(key, value) {
  assertKey(key);
  if (typeof value !== 'string') {
    throw new Error('Invalid value provided to SecureStore. Values must be strings.');
  }
  fault?.('set', key);
  store.set(key, value);
}

export async function deleteItemAsync(key) {
  assertKey(key);
  fault?.('delete', key);
  store.delete(key);
}

export default { getItemAsync, setItemAsync, deleteItemAsync };
