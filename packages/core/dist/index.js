"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  APP_ENTRY_PERMISSIONS: () => APP_ENTRY_PERMISSIONS,
  APP_JOBS: () => APP_JOBS,
  APP_NAMES: () => APP_NAMES,
  ApiError: () => ApiError,
  BRANCH_LOCKED_ROLE_KEYS: () => BRANCH_LOCKED_ROLE_KEYS,
  CATALOG_ITEMS_READ: () => CATALOG_ITEMS_READ,
  DEFAULT_PLATFORM_CONFIG: () => DEFAULT_PLATFORM_CONFIG,
  DEFAULT_PLATFORM_HOST_SUFFIX: () => DEFAULT_PLATFORM_HOST_SUFFIX,
  DEFAULT_STOCK_SETTINGS: () => DEFAULT_STOCK_SETTINGS,
  GROCERY_INVOICES_CANCEL: () => GROCERY_INVOICES_CANCEL,
  GROCERY_INVOICES_CREATE: () => GROCERY_INVOICES_CREATE,
  GROCERY_INVOICES_PAY: () => GROCERY_INVOICES_PAY,
  HISTORY_SLACK_MS: () => HISTORY_SLACK_MS,
  INVENTORY_READ: () => INVENTORY_READ,
  INVENTORY_TRANSFER: () => INVENTORY_TRANSFER,
  INVENTORY_WRITE: () => INVENTORY_WRITE,
  ITEM_PAGE_SIZE: () => ITEM_PAGE_SIZE,
  MAX_BASELINE: () => MAX_BASELINE,
  MAX_DISPLAY_NAME_LENGTH: () => MAX_DISPLAY_NAME_LENGTH,
  MAX_KNOWN_STAFF: () => MAX_KNOWN_STAFF,
  MAX_QTY_UNITS: () => MAX_QTY_UNITS,
  MAX_SPOIL_LINES: () => MAX_SPOIL_LINES,
  MIN_SEARCH_LENGTH: () => MIN_SEARCH_LENGTH,
  NATIVE_KIOSK_CLIENT_HEADER: () => NATIVE_KIOSK_CLIENT_HEADER,
  NATIVE_KIOSK_CLIENT_VALUE: () => NATIVE_KIOSK_CLIENT_VALUE,
  PAIRING_CODE_MAX_LENGTH: () => PAIRING_CODE_MAX_LENGTH,
  PAIRING_CODE_MIN_LENGTH: () => PAIRING_CODE_MIN_LENGTH,
  PURCHASING_PATH_A_WRITE: () => PURCHASING_PATH_A_WRITE,
  QTY_SCALE: () => QTY_SCALE,
  READ_TIMEOUT_MS: () => READ_TIMEOUT_MS,
  SHOP_CODE_ALPHABET: () => SHOP_CODE_ALPHABET,
  SHOP_CODE_MAX_LENGTH: () => SHOP_CODE_MAX_LENGTH,
  SHOP_CODE_MIN_LENGTH: () => SHOP_CODE_MIN_LENGTH,
  SPOIL_LIST_LIFETIME_MS: () => SPOIL_LIST_LIFETIME_MS,
  SPOIL_REASONS: () => SPOIL_REASONS,
  SPOIL_SETTLE_MS: () => SPOIL_SETTLE_MS,
  STAFF_APPS: () => STAFF_APPS,
  STOCK_TAKE_APPROVE: () => STOCK_TAKE_APPROVE,
  STOCK_TAKE_RUN: () => STOCK_TAKE_RUN,
  StoreLookupError: () => StoreLookupError,
  StoreSwitchBlockedError: () => StoreSwitchBlockedError,
  TILL_DEVICE_HEADER: () => TILL_DEVICE_HEADER,
  TimeoutError: () => TimeoutError,
  UNOWNED_ID: () => UNOWNED_ID,
  WRITE_TIMEOUT_MS: () => WRITE_TIMEOUT_MS,
  activateStore: () => activateStore,
  addKnownStaff: () => addKnownStaff,
  addSpoil: () => addSpoil,
  allocationPreviewPath: () => allocationPreviewPath,
  apiRequest: () => apiRequest,
  appsThatFit: () => appsThatFit,
  asSetupRequired: () => asSetupRequired,
  batchDecreaseBody: () => batchDecreaseBody,
  beginSending: () => beginSending,
  beginSpoil: () => beginSpoil,
  bootstrapStore: () => bootstrapStore,
  bootstrapTenant: () => bootstrapTenant,
  checkTillRegistration: () => checkTillRegistration,
  claimSpoils: () => claimSpoils,
  classifyStore: () => classifyStore,
  classifyWrite: () => classifyWrite,
  cleanDisplayText: () => cleanDisplayText,
  cleanSearchText: () => cleanSearchText,
  clearActiveStore: () => clearActiveStore,
  clearKnownStaff: () => clearKnownStaff,
  clearSpoils: () => clearSpoils,
  clearTenant: () => clearTenant,
  clearTokens: () => clearTokens,
  compareVersions: () => compareVersions,
  counterModes: () => counterModes,
  createApiClient: () => createApiClient,
  createKeeper: () => createKeeper,
  decodeSpoils: () => decodeSpoils,
  describeFailure: () => describeFailure,
  describeSetup: () => describeSetup,
  describeShopCodeProblem: () => describeShopCodeProblem,
  describeStoreResult: () => describeStoreResult,
  dropTenantKeepers: () => dropTenantKeepers,
  emptySpoils: () => emptySpoils,
  encodeSpoils: () => encodeSpoils,
  endSession: () => endSession,
  ensureStorageReady: () => ensureStorageReady,
  fetchBranches: () => fetchBranches,
  fetchCategories: () => fetchCategories,
  fetchDepartments: () => fetchDepartments,
  fetchMe: () => fetchMe,
  fetchPlatformConfig: () => fetchPlatformConfig,
  fetchPublicMobileConfig: () => fetchPublicMobileConfig,
  fetchShiftsDisabled: () => fetchShiftsDisabled,
  findNewSpoil: () => findNewSpoil,
  firstName: () => firstName,
  fitsApp: () => fitsApp,
  forgetKnownStaff: () => forgetKnownStaff,
  forgetStore: () => forgetStore,
  forgetTillRegistered: () => forgetTillRegistered,
  formatApiProblemMessage: () => formatApiProblemMessage,
  formatCents: () => formatCents,
  formatKes: () => formatKes,
  formatQty: () => formatQty,
  generateIdempotencyKey: () => generateIdempotencyKey,
  getAccessToken: () => getAccessToken,
  getActiveTenantId: () => getActiveTenantId,
  getAppVersion: () => getAppVersion,
  getEmbeddedTenantSlug: () => getEmbeddedTenantSlug,
  getOrCreateTillDeviceId: () => getOrCreateTillDeviceId,
  getRefreshToken: () => getRefreshToken,
  getTenantDisplayName: () => getTenantDisplayName,
  getTenantHeaders: () => getTenantHeaders,
  getUnsentSummary: () => getUnsentSummary,
  getWhiteLabelExtra: () => getWhiteLabelExtra,
  interpretTillAnswer: () => interpretTillAnswer,
  isApiError: () => isApiError,
  isBranchLockedRole: () => isBranchLockedRole,
  isProvisionalId: () => isProvisionalId,
  isShopperDeepLinkIntent: () => isShopperDeepLinkIntent,
  isSpoilReason: () => isSpoilReason,
  isStaffDeepLinkIntent: () => isStaffDeepLinkIntent,
  isWhiteLabelApp: () => isWhiteLabelApp,
  itemLabel: () => itemLabel,
  itemsPath: () => itemsPath,
  listRememberedStores: () => listRememberedStores,
  loadActiveStore: () => loadActiveStore,
  loadKnownStaff: () => loadKnownStaff,
  loadStoreById: () => loadStoreById,
  loadTenant: () => loadTenant,
  loginWithPassword: () => loginWithPassword,
  loginWithPin: () => loginWithPin,
  logout: () => logout,
  markSessionEnded: () => markSessionEnded,
  mayCloseStockTake: () => mayCloseStockTake,
  mayCountStock: () => mayCountStock,
  mayMoveStock: () => mayMoveStock,
  mayOrderAtCounter: () => mayOrderAtCounter,
  maySellAtCounter: () => maySellAtCounter,
  nextSpoil: () => nextSpoil,
  openRememberedStore: () => openRememberedStore,
  openStore: () => openStore,
  outboxKey: () => outboxKey,
  parseKnownStaff: () => parseKnownStaff,
  parseMe: () => parseMe,
  parsePairingCode: () => parsePairingCode,
  parsePairingPreview: () => parsePairingPreview,
  parsePairingScan: () => parsePairingScan,
  parsePlatformConfig: () => parsePlatformConfig,
  parseProblem: () => parseProblem,
  parseQty: () => parseQty,
  parseScan: () => parseScan,
  parseShopCode: () => parseShopCode,
  parseShopCodeLink: () => parseShopCodeLink,
  parseSignedInUser: () => parseSignedInUser,
  parseStockSettings: () => parseStockSettings,
  parseStoreInput: () => parseStoreInput,
  parseTenantDeepLink: () => parseTenantDeepLink,
  parseVersion: () => parseVersion,
  pinLoginBranchId: () => pinLoginBranchId,
  pinnedTo: () => pinnedTo,
  plainHost: () => plainHost,
  planDecreaseCalls: () => planDecreaseCalls,
  planSetOnHand: () => planSetOnHand,
  previewDeepLink: () => previewDeepLink,
  previewPairing: () => previewPairing,
  previewStore: () => previewStore,
  previewStoreByCode: () => previewStoreByCode,
  priceToCents: () => priceToCents,
  provisionalId: () => provisionalId,
  publicApiRequest: () => publicApiRequest,
  qtyProblemWords: () => qtyProblemWords,
  qtyToUnits: () => qtyToUnits,
  readApiError: () => readApiError,
  readApiErrorMessage: () => readApiErrorMessage,
  readAuthTokens: () => readAuthTokens,
  readCategories: () => readCategories,
  readCookieFromSetCookie: () => readCookieFromSetCookie,
  readDepartments: () => readDepartments,
  readFailureWords: () => readFailureWords,
  readHistory: () => readHistory,
  readItemHistory: () => readItemHistory,
  readItemsPage: () => readItemsPage,
  readSetCookieLines: () => readSetCookieLines,
  readShiftsDisabled: () => readShiftsDisabled,
  readStockItem: () => readStockItem,
  readTenantSecret: () => readTenantSecret,
  readTenantValue: () => readTenantValue,
  redeemPairing: () => redeemPairing,
  refreshAccessToken: () => refreshAccessToken,
  registerAccount: () => registerAccount,
  registerUnsentProbe: () => registerUnsentProbe,
  rememberStaff: () => rememberStaff,
  rememberTillRegistered: () => rememberTillRegistered,
  removeKnownStaff: () => removeKnownStaff,
  removeSpoil: () => removeSpoil,
  removeTenantSecret: () => removeTenantSecret,
  removeTenantValue: () => removeTenantValue,
  requestTillAccess: () => requestTillAccess,
  resendVerificationEmail: () => resendVerificationEmail,
  resolveIdempotencyKey: () => resolveIdempotencyKey,
  resolveMobileApiBaseUrl: () => resolveMobileApiBaseUrl,
  resolveShopperStore: () => resolveShopperStore,
  resolveTenant: () => resolveTenant,
  resolveTenantByEmail: () => resolveTenantByEmail,
  resolveTenantFromDeepLink: () => resolveTenantFromDeepLink,
  revalidateActive: () => revalidateActive,
  searchStores: () => searchStores,
  searchTerms: () => searchTerms,
  serializeKnownStaff: () => serializeKnownStaff,
  sessionWasEnded: () => sessionWasEnded,
  setReason: () => setReason,
  setSpoilUnits: () => setSpoilUnits,
  shiftsAreDisabled: () => shiftsAreDisabled,
  spoilDone: () => spoilDone,
  spoilNotDone: () => spoilNotDone,
  spoilOperations: () => spoilOperations,
  spoilSkipped: () => spoilSkipped,
  spoilUnitCostCents: () => spoilUnitCostCents,
  spoilVerdict: () => spoilVerdict,
  stockAppMayWrite: () => stockAppMayWrite,
  stockIncreaseBody: () => stockIncreaseBody,
  storeTokens: () => storeTokens,
  subscribeActiveStore: () => subscribeActiveStore,
  subscribeActiveStoreId: () => subscribeActiveStoreId,
  supplierItemTypeScope: () => supplierItemTypeScope,
  switchStore: () => switchStore,
  tenantHost: () => tenantHost,
  tenantHostSuffix: () => tenantHostSuffix,
  tenantKeeper: () => tenantKeeper,
  unitsToQty: () => unitsToQty,
  unreadableOutboxKey: () => unreadableOutboxKey,
  unwrapOpened: () => unwrapOpened,
  updateStateFor: () => updateStateFor,
  useTenantDeepLink: () => useTenantDeepLink,
  visibleDepartments: () => visibleDepartments,
  wastageBody: () => wastageBody,
  webHomeForRole: () => webHomeForRole,
  withOutboxLock: () => withOutboxLock,
  withTimeout: () => withTimeout,
  writeTenantSecret: () => writeTenantSecret,
  writeTenantValue: () => writeTenantValue
});
module.exports = __toCommonJS(index_exports);

// src/mobile-config.ts
var import_expo_constants = __toESM(require("expo-constants"));
var BACKEND_PORT = 5050;
function debuggerHostname() {
  const hostUri = import_expo_constants.default.expoConfig?.hostUri ?? import_expo_constants.default.expoGoConfig?.debuggerHost ?? import_expo_constants.default.manifest2?.extra?.expoClient?.hostUri;
  if (!hostUri) return null;
  const withoutProtocol = hostUri.replace(/^exp\+[\w-]+:\/\//, "").replace(/^https?:\/\//, "");
  const hostname = withoutProtocol.split(":")[0]?.trim();
  return hostname || null;
}
function resolveMobileApiBaseUrl() {
  const extra = import_expo_constants.default.expoConfig?.extra;
  const configured = extra?.apiBaseUrl ?? extra?.apiBaseURL;
  if (configured && !configured.includes("192.168.100.2")) {
    return configured.replace(/\/$/, "");
  }
  const host = debuggerHostname();
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:${BACKEND_PORT}`;
  }
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return `http://localhost:${BACKEND_PORT}`;
}
var DEFAULT_PLATFORM_HOST_SUFFIX = "kiosk.ke";
function tenantHostSuffix() {
  const configured = import_expo_constants.default.expoConfig?.extra?.tenantHostSuffix;
  return typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_PLATFORM_HOST_SUFFIX;
}
function tenantHost() {
  const host = import_expo_constants.default.expoConfig?.extra?.tenantHost;
  if (typeof host !== "string") return null;
  const trimmed = host.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0] ?? "";
  return trimmed || null;
}
function getWhiteLabelExtra() {
  const extra = import_expo_constants.default.expoConfig?.extra ?? {};
  return {
    tenantId: extra.tenantId?.trim() || extra.embeddedTenantSlug?.trim() || null,
    apiBaseUrl: extra.apiBaseUrl ?? extra.apiBaseURL ?? null,
    themeColors: extra.themeColors ?? null,
    isWhiteLabel: extra.isWhiteLabel === true
  };
}

// src/shop-code.ts
var SHOP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
var SHOP_CODE_MIN_LENGTH = 5;
var SHOP_CODE_MAX_LENGTH = 6;
function parseShopCode(input) {
  const code = input.toUpperCase().replace(/[\s._-]/g, "");
  const invalid = [...new Set([...code].filter((character) => !SHOP_CODE_ALPHABET.includes(character)))];
  if (invalid.length > 0) {
    return { kind: "invalid_characters", characters: invalid };
  }
  if (code.length < SHOP_CODE_MIN_LENGTH) {
    return { kind: "incomplete" };
  }
  return code.length > SHOP_CODE_MAX_LENGTH ? { kind: "too_long" } : { kind: "ok", code };
}
var CONFUSED = /* @__PURE__ */ new Set(["0", "O", "1", "I", "L"]);
function describeShopCodeProblem(parse) {
  switch (parse.kind) {
    case "ok":
    case "incomplete":
      return null;
    case "too_long":
      return `Shop codes have at most ${SHOP_CODE_MAX_LENGTH} characters.`;
    case "invalid_characters":
      return parse.characters.every((character) => CONFUSED.has(character)) ? "Shop codes never use the letters I, L or O, or the digits 0 and 1." : "Shop codes use letters and numbers only.";
  }
}
var SHOP_CODE_LINK = /^(?:kiosk:\/\/c|https?:\/\/([^/?#]+)\/c)\/([^/?#]+)\/?(?:[?#].*)?$/i;
function onPlatformApex(host) {
  const suffix = tenantHostSuffix().trim().toLowerCase().replace(/^\./, "");
  const bare = host.toLowerCase().replace(/:\d+$/, "");
  return bare === suffix || bare === `www.${suffix}`;
}
function parseShopCodeLink(url) {
  const match = SHOP_CODE_LINK.exec(url.trim());
  if (!match) {
    return null;
  }
  const host = match[1];
  if (host !== void 0 && !onPlatformApex(host)) {
    return null;
  }
  let candidate = match[2] ?? "";
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  const parse = parseShopCode(candidate);
  return parse.kind === "ok" ? parse.code : null;
}

// src/storage.ts
var SecureStore = __toESM(require("expo-secure-store"));

// src/storage-keys.ts
var STORAGE_VERSION = 2;
var SCHEMA_KEY = "kiosk.storageVersion";
var MIGRATING_PREFIX = "migrating:";
var ACTIVE_TENANT_KEY = "kiosk.v2.activeTenant";
var RECENT_TENANTS_KEY = "kiosk.v2.recentTenants";
var PROVISIONAL_KEY = "kiosk.v2.provisional";
var SECURE_INDEX_KEY = "kiosk.v2.secureIndex";
var CORRUPT_OUTBOX_KEY = "kiosk.v2.corruptOutbox";
var RECENT_LIMIT = 5;
var SECURE_FIELDS = ["accessToken", "refreshToken", "tillDeviceId", "deviceSecret"];
var PLAIN_FIELDS = [
  "profile",
  "tabPhone",
  "airtimeRecipient",
  "airtimePayer",
  /** Staff apps: the people who have signed in on this phone at this shop (first name and email), for the sign-in chips. */
  "knownStaff",
  /** Staff apps: the branch this phone was last seen registered as a till for. Lets the app say "removed", not "never registered". */
  "tillSeen",
  /** Cashier: the sales its people have put on hold at this shop, until they come back for them (a day at most). */
  "heldBaskets",
  /** Cashier: a copy of the shop's price list for the till's branch, so the till can find and sell products with no connection. */
  "catalog",
  /** Cashier: what the shop last said its till may do (the shop's feature flags), for a till that starts with no connection. */
  "shopFlags",
  /** Cashier: a short record, for a manager, of what the till could not put right by itself (sales thrown away, repriced, sent by someone else). */
  "tillLog",
  /** Cashier: the Bluetooth receipt printer this till is paired with (id, name, paper width), so it reconnects without a fresh scan. */
  "savedPrinter",
  /** Cashier: a tally of which products this till reaches for most, to lead the grid with best-sellers. */
  "topSellers",
  /** Cashier: this till's shift-progress stats (sales counted this shift, clean-close streak), for the shift gamification cues. */
  "shiftPulse",
  /** Cashier: which people have already been shown the first-day tips at this shop, so nobody sees them twice. */
  "firstRun",
  /** Grocery: baskets parked at the counter, so several sales can be on the go at once (the web counter's drafts). */
  "groceryDrafts",
  /** Grocery: the sale being rung up at the counter, kept until it is sent forward or cleared (a day at most). */
  "groceryBasket",
  /** Grocery: the sales sent forward to the cashier that the server has not yet confirmed, with the keys that make resending them safe. */
  "groceryForwards",
  /** Grocery and Stock: the write-offs being listed, and the one write-off that was sent and not yet confirmed, so a closed app cannot lose track of it. */
  "spoils",
  /** Stock: the stock take being counted, with the counts typed so far, so counting goes on with no connection. */
  "stockTake"
];
var RESERVED_IDS = /* @__PURE__ */ new Set([
  "tenant",
  "activeTenant",
  "recentTenants",
  "provisional",
  "secureIndex",
  "installId"
]);
function assertTenantId(id3) {
  if (!isStorableTenantId(id3)) {
    throw new Error("Invalid tenant id for storage.");
  }
  return id3;
}
function isStorableTenantId(id3) {
  return typeof id3 === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id3) && !RESERVED_IDS.has(id3);
}
var PROVISIONAL_PREFIX = "pending-";
function isProvisionalId(id3) {
  return id3.startsWith(PROVISIONAL_PREFIX);
}
var UNOWNED_ID = "unowned";
function snapshotKey(tenantId) {
  return `kiosk.v2.tenant.${assertTenantId(tenantId)}`;
}
function secureKey(tenantId, field) {
  return `kiosk.v2.${assertTenantId(tenantId)}.${field}`;
}
function plainKey(tenantId, field) {
  return `kiosk.v2.${assertTenantId(tenantId)}.${field}`;
}
function outboxKey(tenantId) {
  return `@kiosk/offline/outbox/${assertTenantId(tenantId)}`;
}
function unreadableOutboxKey(tenantId) {
  return `${outboxKey(tenantId)}.unreadable`;
}
function provisionalId(slug) {
  return `${PROVISIONAL_PREFIX}${slug}`;
}
var LEGACY_SECURE = {
  tenant: "kiosk.tenant",
  accessToken: "kiosk.accessToken",
  refreshToken: "kiosk.refreshToken",
  tillDeviceId: "ub.tillDeviceId",
  deviceSecret: "palmart.shopper.deviceSecret"
};
var LEGACY_PLAIN = {
  outbox: "@kiosk/offline/outbox",
  profile: "palmart.shopper.profile",
  tabPhone: "palmart.customer.tabPhone",
  airtimeRecipient: "palmart.customer.lastAirtimeRecipient",
  airtimePayer: "palmart.customer.lastAirtimePayer"
};

// src/storage.ts
var overrides = {};
var nativeSecure = null;
var nativePlain = null;
var indexLock = Promise.resolve();
var resetters = /* @__PURE__ */ new Set();
function onRuntimeReset(fn) {
  resetters.add(fn);
}
var SECURE_KEY = /^[\w.-]+$/;
function secureAdapter() {
  return {
    get: (key) => SecureStore.getItemAsync(key),
    set: (key, value) => SecureStore.setItemAsync(key, value),
    remove: (key) => SecureStore.deleteItemAsync(key)
  };
}
function secureAsPlainAdapter() {
  const inner = secureAdapter();
  return {
    get: (key) => SECURE_KEY.test(key) ? inner.get(key) : Promise.resolve(null),
    set: (key, value) => inner.set(key, value),
    remove: (key) => SECURE_KEY.test(key) ? inner.remove(key) : Promise.resolve()
  };
}
function secure() {
  if (overrides.secure) {
    return overrides.secure;
  }
  if (!nativeSecure) {
    nativeSecure = secureAdapter();
  }
  return nativeSecure;
}
var NOT_LINKED = /native\s?module|is null|not linked/i;
async function loadAsyncStorage() {
  let storage;
  try {
    storage = (await import("@react-native-async-storage/async-storage")).default;
    await storage.getItem("kiosk.v2.probe");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!storage || NOT_LINKED.test(message)) {
      return null;
    }
    throw error;
  }
  const linked = storage;
  return {
    get: (key) => linked.getItem(key),
    set: (key, value) => linked.setItem(key, value),
    remove: (key) => linked.removeItem(key)
  };
}
function plain() {
  if (overrides.plain) {
    return Promise.resolve(overrides.plain);
  }
  if (!nativePlain) {
    const pending = loadAsyncStorage().then((storage) => storage ?? secureAsPlainAdapter());
    nativePlain = pending;
    pending.catch(() => {
      if (nativePlain === pending) {
        nativePlain = null;
      }
    });
  }
  return nativePlain;
}
async function readJson(store, key) {
  const raw = await store.get(key);
  if (raw == null) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function writeJson(store, key, value) {
  await store.set(key, JSON.stringify(value));
}
function withIndexLock(work) {
  const run = indexLock.then(work, work);
  indexLock = run.catch(() => void 0);
  return run;
}
async function readIndex() {
  const parsed = await readJson(secure(), SECURE_INDEX_KEY);
  return Array.isArray(parsed) ? parsed.filter((key) => typeof key === "string") : [];
}
async function securePut(key, value) {
  if (!SECURE_KEY.test(key)) {
    throw new Error("Invalid secure storage key.");
  }
  await withIndexLock(async () => {
    const index = await readIndex();
    if (!index.includes(key)) {
      index.push(key);
      await writeJson(secure(), SECURE_INDEX_KEY, index);
    }
  });
  await secure().set(key, value);
}
function secureGet(key) {
  return secure().get(key);
}
async function secureRemove(key) {
  await secure().remove(key);
  await withIndexLock(async () => {
    const index = await readIndex();
    const next = index.filter((entry) => entry !== key);
    if (next.length !== index.length) {
      await writeJson(secure(), SECURE_INDEX_KEY, next);
    }
  });
}
async function purgeSecureIndex() {
  return withIndexLock(async () => {
    const index = await readIndex();
    const remaining = [];
    let removed = 0;
    for (const key of index) {
      try {
        await secure().remove(key);
        removed += 1;
      } catch {
        remaining.push(key);
      }
    }
    if (remaining.length) {
      await writeJson(secure(), SECURE_INDEX_KEY, remaining);
    } else {
      await secure().remove(SECURE_INDEX_KEY);
    }
    return { removed, failed: remaining.length };
  });
}

// src/outbox-lock.ts
var tail = Promise.resolve();
function withOutboxLock(work) {
  const run = tail.then(() => work());
  tail = run.catch(() => void 0);
  return run;
}
onRuntimeReset(() => {
  tail = Promise.resolve();
});

// src/embedded-config.ts
var import_expo_constants2 = __toESM(require("expo-constants"));
function getEmbeddedTenantSlug() {
  const slug = import_expo_constants2.default.expoConfig?.extra?.embeddedTenantSlug;
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  return trimmed || null;
}
function isWhiteLabelApp() {
  return import_expo_constants2.default.expoConfig?.extra?.isWhiteLabel === true;
}
function getTenantDisplayName() {
  const name = import_expo_constants2.default.expoConfig?.extra?.tenantDisplayName;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed || null;
}

// src/tenant-store.ts
function isSnapshot(value) {
  const v = value;
  return Boolean(
    v && typeof v.businessId === "string" && typeof v.slug === "string" && typeof v.host === "string" && typeof v.displayName === "string"
  );
}
async function readSnapshot(store, tenantId) {
  const parsed = await readJson(store, snapshotKey(tenantId));
  return isSnapshot(parsed) ? { ...parsed, branding: parsed.branding ?? {} } : null;
}
async function writeSnapshot(store, snapshot) {
  assertTenantId(snapshot.businessId);
  await writeJson(store, snapshotKey(snapshot.businessId), snapshot);
}
async function removeSnapshot(store, tenantId) {
  await store.remove(snapshotKey(tenantId));
}
async function readPointer(store) {
  const raw = await store.get(ACTIVE_TENANT_KEY);
  const id3 = raw?.trim();
  return id3 ? id3 : null;
}
async function writePointer(store, tenantId) {
  if (tenantId === null) {
    await store.remove(ACTIVE_TENANT_KEY);
    return;
  }
  await store.set(ACTIVE_TENANT_KEY, assertTenantId(tenantId));
}
async function readRecents(store) {
  const parsed = await readJson(store, RECENT_TENANTS_KEY);
  return Array.isArray(parsed) ? parsed.filter((id3) => typeof id3 === "string") : [];
}
async function writeRecents(store, ids) {
  await writeJson(store, RECENT_TENANTS_KEY, ids.slice(0, RECENT_LIMIT));
}
async function rememberTenant(store, tenantId) {
  const ids = await readRecents(store);
  await writeRecents(store, [tenantId, ...ids.filter((id3) => id3 !== tenantId)]);
}
async function readProvisional(store) {
  const parsed = await readJson(store, PROVISIONAL_KEY);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry) => typeof entry[1] === "string"
    )
  );
}
async function writeProvisional(store, map) {
  if (Object.keys(map).length === 0) {
    await store.remove(PROVISIONAL_KEY);
    return;
  }
  await writeJson(store, PROVISIONAL_KEY, map);
}

// src/storage-schema.ts
var readyPromise = null;
onRuntimeReset(() => {
  readyPromise = null;
});
function ensureStorageReady() {
  if (!readyPromise) {
    readyPromise = runSetup().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}
async function runSetup() {
  const store = await plain();
  const marker = await store.get(SCHEMA_KEY);
  const record = marker?.startsWith(MIGRATING_PREFIX) ? { ownerSlug: marker.slice(MIGRATING_PREFIX.length) || null } : null;
  if (!record && Number(marker) >= STORAGE_VERSION) {
    return;
  }
  const legacy = await readLegacy(store);
  if (record || legacy.anyPlain || isWhiteLabelApp() && legacy.anySecure) {
    await migrateV1(store, legacy, record);
  } else {
    await clearLeftovers();
    await store.set(SCHEMA_KEY, String(STORAGE_VERSION));
  }
}
async function readLegacy(store) {
  const tenantRaw = await secureGet(LEGACY_SECURE.tenant);
  let tenant = null;
  if (tenantRaw) {
    try {
      const parsed = JSON.parse(tenantRaw);
      tenant = parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      tenant = null;
    }
  }
  const secureValues = {
    accessToken: await secureGet(LEGACY_SECURE.accessToken),
    refreshToken: await secureGet(LEGACY_SECURE.refreshToken),
    tillDeviceId: await secureGet(LEGACY_SECURE.tillDeviceId),
    deviceSecret: await secureGet(LEGACY_SECURE.deviceSecret)
  };
  const plainValues = {
    profile: await store.get(LEGACY_PLAIN.profile),
    tabPhone: await store.get(LEGACY_PLAIN.tabPhone),
    airtimeRecipient: await store.get(LEGACY_PLAIN.airtimeRecipient),
    airtimePayer: await store.get(LEGACY_PLAIN.airtimePayer),
    // Staff-app fields: the original layout never held them.
    knownStaff: null,
    tillSeen: null,
    heldBaskets: null,
    catalog: null,
    shopFlags: null,
    tillLog: null,
    savedPrinter: null,
    topSellers: null,
    shiftPulse: null,
    firstRun: null,
    groceryDrafts: null,
    groceryBasket: null,
    groceryForwards: null,
    spoils: null,
    stockTake: null
  };
  const outboxRaw = await store.get(LEGACY_PLAIN.outbox);
  return {
    tenant,
    secure: secureValues,
    plain: plainValues,
    outboxRaw,
    anySecure: tenantRaw !== null || Object.values(secureValues).some((value) => value !== null),
    anyPlain: outboxRaw !== null || Object.values(plainValues).some((value) => value !== null)
  };
}
function decideOwner(legacy) {
  const embedded = getEmbeddedTenantSlug()?.toLowerCase() ?? null;
  const pointed = typeof legacy.tenant?.slug === "string" ? legacy.tenant.slug.trim().toLowerCase() : null;
  const owner = embedded ? pointed && pointed !== embedded ? null : embedded : pointed;
  return owner && isStorableTenantId(provisionalId(owner)) ? owner : null;
}
function parseOutbox(raw) {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => Boolean(item) && typeof item === "object") : [];
  } catch {
    return [];
  }
}
function itemId(item) {
  return typeof item.id === "string" ? item.id : null;
}
async function mergeOutbox(store, tenantId, incoming) {
  const key = outboxKey(tenantId);
  const merged = parseOutbox(await store.get(key));
  const seen = new Set(merged.map(itemId).filter((id3) => id3 !== null));
  for (const item of incoming) {
    const id3 = itemId(item);
    if (id3 !== null && seen.has(id3)) {
      continue;
    }
    if (id3 !== null) {
      seen.add(id3);
    }
    merged.push(item);
  }
  await store.set(key, JSON.stringify(merged));
}
async function assertQueued(store, tenantId, expected) {
  const present = new Set(parseOutbox(await store.get(outboxKey(tenantId))).map(itemId));
  for (const item of expected) {
    const id3 = itemId(item);
    if (id3 !== null && !present.has(id3)) {
      throw new Error("Storage migration could not be verified; the original data was kept.");
    }
  }
}
async function migrateV1(store, legacy, record) {
  const ownerSlug = record ? record.ownerSlug : decideOwner(legacy);
  if (!record) {
    await store.set(SCHEMA_KEY, `${MIGRATING_PREFIX}${ownerSlug ?? ""}`);
  }
  const id3 = ownerSlug ? provisionalId(ownerSlug) : null;
  let queued = [];
  if (legacy.outboxRaw !== null) {
    queued = parseOutbox(legacy.outboxRaw);
    if (queued.length === 0 && legacy.outboxRaw.trim() && legacy.outboxRaw.trim() !== "[]") {
      await store.set(CORRUPT_OUTBOX_KEY, legacy.outboxRaw);
    }
  }
  const bucket = id3 ?? UNOWNED_ID;
  if (queued.length > 0) {
    await mergeOutbox(store, bucket, queued.map((item) => ({ ...item, tenantId: bucket })));
    await assertQueued(store, bucket, queued);
  }
  if (id3 && ownerSlug) {
    const provisional = await readProvisional(store);
    await writeProvisional(store, { ...provisional, [ownerSlug]: id3 });
    if (legacy.tenant) {
      await writeSnapshot(store, {
        businessId: id3,
        slug: ownerSlug,
        host: typeof legacy.tenant.host === "string" ? legacy.tenant.host : "",
        displayName: typeof legacy.tenant.displayName === "string" ? legacy.tenant.displayName : ownerSlug,
        branding: legacy.tenant.branding && typeof legacy.tenant.branding === "object" ? legacy.tenant.branding : {},
        // The v1 record has no fetch time. The epoch reads as "unknown, treat as stale".
        fetchedAt: (/* @__PURE__ */ new Date(0)).toISOString()
      });
      await writePointer(store, id3);
      await rememberTenant(store, id3);
    }
    for (const field of SECURE_FIELDS) {
      const value = legacy.secure[field];
      if (value !== null) {
        await securePut(secureKey(id3, field), value);
        if (await secureGet(secureKey(id3, field)) !== value) {
          throw new Error("Storage migration could not be verified; the original data was kept.");
        }
      }
    }
    for (const field of PLAIN_FIELDS) {
      const value = legacy.plain[field];
      if (value !== null) {
        await store.set(plainKey(id3, field), value);
      }
    }
  }
  await secure().remove(LEGACY_SECURE.accessToken);
  await secure().remove(LEGACY_SECURE.refreshToken);
  await secure().remove(LEGACY_SECURE.tillDeviceId);
  await secure().remove(LEGACY_SECURE.deviceSecret);
  for (const key of Object.values(LEGACY_PLAIN)) {
    await store.remove(key);
  }
  await secure().remove(LEGACY_SECURE.tenant);
  await store.set(SCHEMA_KEY, String(STORAGE_VERSION));
}
async function clearLeftovers() {
  const { failed } = await purgeSecureIndex();
  for (const key of Object.values(LEGACY_SECURE)) {
    await secure().remove(key);
  }
  if (failed > 0) {
    throw new Error("Could not clear data left by a previous install.");
  }
}
async function moveNamespace(store, from, to) {
  for (const field of SECURE_FIELDS) {
    const value = await secureGet(secureKey(from, field));
    if (value !== null && await secureGet(secureKey(to, field)) === null) {
      await securePut(secureKey(to, field), value);
    }
  }
  for (const field of PLAIN_FIELDS) {
    const value = await store.get(plainKey(from, field));
    if (value !== null && await store.get(plainKey(to, field)) === null) {
      await store.set(plainKey(to, field), value);
    }
  }
  const moved = parseOutbox(await store.get(outboxKey(from)));
  if (moved.length > 0) {
    await mergeOutbox(store, to, moved.map((item) => ({ ...item, tenantId: to })));
    await assertQueued(store, to, moved);
  }
  for (const field of SECURE_FIELDS) {
    await secureRemove(secureKey(from, field));
  }
  for (const field of PLAIN_FIELDS) {
    await store.remove(plainKey(from, field));
  }
  await store.remove(outboxKey(from));
}
async function adoptProvisional(slug, verifiedId) {
  const store = await plain();
  const map = await readProvisional(store);
  const from = map[slug];
  if (!from) {
    return false;
  }
  if (from !== verifiedId) {
    await moveNamespace(store, from, verifiedId);
    if (await readPointer(store) === from) {
      await writePointer(store, verifiedId);
    }
    const recents = await readRecents(store);
    await writeRecents(store, [...new Set(recents.map((id3) => id3 === from ? verifiedId : id3))]);
    await removeSnapshot(store, from);
  }
  const { [slug]: _adopted, ...rest } = map;
  await writeProvisional(store, rest);
  return from !== verifiedId;
}
async function removeNamespace(tenantId, options = {}) {
  const store = await plain();
  for (const field of SECURE_FIELDS) {
    await secureRemove(secureKey(tenantId, field));
  }
  for (const field of PLAIN_FIELDS) {
    await store.remove(plainKey(tenantId, field));
  }
  await removeSnapshot(store, tenantId);
  if (options.dropOutbox) {
    await store.remove(outboxKey(tenantId));
    await store.remove(unreadableOutboxKey(tenantId));
  }
  const recents = await readRecents(store);
  await writeRecents(store, recents.filter((id3) => id3 !== tenantId));
  const provisional = await readProvisional(store);
  const kept = Object.fromEntries(Object.entries(provisional).filter(([, id3]) => id3 !== tenantId));
  if (Object.keys(kept).length !== Object.keys(provisional).length) {
    await writeProvisional(store, kept);
  }
}

// src/display-text.ts
var INVISIBLE = new RegExp(
  [
    "[\\u0000-\\u001F\\u007F-\\u009F\\u00AD\\u061C\\u180E\\u200B\\u200E\\u200F\\u202A-\\u202E\\u2060-\\u206F\\uFFF9-\\uFFFB",
    // Fillers: Hangul, Khmer inherent vowels and the blank braille pattern.
    "\\u115F\\u1160\\u17B4\\u17B5\\u2800\\u3164\\uFFA0",
    // Variation selectors 1 to 14 (not 15 and 16, which choose text or emoji style).
    "\\uFE00-\\uFE0D]",
    // Tag characters (U+E0000 to U+E007F) and the variation selectors supplement (U+E0100 to U+E01EF).
    "|\\uDB40[\\uDC00-\\uDC7F\\uDD00-\\uDDEF]"
  ].join(""),
  "g"
);
var MAX_DISPLAY_NAME_LENGTH = 80;
var HOST_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+(?::\d{1,5})?$/;
function plainHost(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const clean = raw.trim().toLowerCase();
  return clean.length > 0 && clean.length <= 253 && HOST_RE.test(clean) ? clean : null;
}
function cleanDisplayText(raw, max = MAX_DISPLAY_NAME_LENGTH) {
  if (typeof raw !== "string") {
    return "";
  }
  const spaced = raw.replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim();
  return Array.from(spaced).slice(0, max).join("").trim();
}

// src/tenant-resolve.ts
var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var HOST_RE2 = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/;
var RESERVED_LABELS = /* @__PURE__ */ new Set([
  "www",
  "api",
  "admin",
  "app",
  "mail",
  "ftp",
  "cdn",
  "static",
  "assets",
  "status",
  "docs",
  "help",
  "support",
  "billing",
  "pay",
  "webhook",
  "webhooks",
  "super-admin",
  "superadmin",
  "platform",
  "null",
  "undefined",
  "marketplace",
  "supplier",
  "suppliers",
  "trade",
  "wholesale",
  "portal",
  "s",
  "shop",
  "shops"
]);
var DEFAULT_TIMEOUT_MS = 1e4;
function parseStoreInput(input) {
  const raw = input.trim().toLowerCase();
  if (!raw) {
    return null;
  }
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  const hostPart = (withoutScheme.split(/[/?#]/)[0] ?? "").replace(/\.$/, "");
  if (!hostPart || hostPart.includes("@")) {
    return null;
  }
  if (!hostPart.includes(".")) {
    return SLUG_RE.test(hostPart) ? { kind: "slug", slug: hostPart } : null;
  }
  return HOST_RE2.test(hostPart) ? { kind: "host", host: hostPart } : null;
}
function platformSlugFromHost(host) {
  const suffix = tenantHostSuffix().trim().toLowerCase().replace(/^\./, "");
  if (!suffix) {
    return null;
  }
  const bare = host.replace(/:\d+$/, "");
  if (!bare.endsWith(`.${suffix}`)) {
    return null;
  }
  const label = bare.slice(0, bare.length - suffix.length - 1);
  return SLUG_RE.test(label) && !RESERVED_LABELS.has(label) ? label : null;
}
async function getJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    let body = null;
    if (response.ok) {
      try {
        body = await response.json();
      } catch {
        return { kind: "offline" };
      }
    }
    return {
      kind: "response",
      status: response.status,
      body,
      retryAfter: response.headers?.get?.("retry-after") ?? null
    };
  } catch {
    return { kind: "offline" };
  } finally {
    clearTimeout(timer);
  }
}
function parseRetryAfter(value) {
  if (!value) {
    return void 0;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds), 3600);
  }
  const at = Date.parse(value);
  return Number.isNaN(at) ? void 0 : Math.min(Math.max(Math.ceil((at - Date.now()) / 1e3), 0), 3600);
}
function transientFailure(fetched) {
  if (fetched.kind === "offline") {
    return { kind: "offline" };
  }
  if (fetched.status === 429) {
    return { kind: "rate_limited", retryAfterSec: parseRetryAfter(fetched.retryAfter) };
  }
  if (fetched.status >= 500 || fetched.status === 408) {
    return { kind: "offline" };
  }
  return null;
}
function normalizeStatus(raw) {
  return typeof raw === "string" && raw.trim() ? raw.trim().toUpperCase() : "ACTIVE";
}
function validId(id3) {
  return isStorableTenantId(id3) && !isProvisionalId(id3);
}
var MAX_STORE_TYPES = 12;
var MAX_CAPABILITIES = 40;
function parseStoreTypes(raw) {
  if (!Array.isArray(raw)) {
    return void 0;
  }
  const types = /* @__PURE__ */ new Set();
  for (const entry of raw) {
    const type = typeof entry === "string" ? entry.trim().toLowerCase() : "";
    if (/^[a-z0-9][a-z0-9_-]{0,39}$/.test(type)) {
      types.add(type);
    }
    if (types.size >= MAX_STORE_TYPES) {
      break;
    }
  }
  return [...types];
}
function parseCapabilities(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return void 0;
  }
  const capabilities = {};
  for (const [name, value] of Object.entries(raw).slice(0, MAX_CAPABILITIES)) {
    if (typeof value === "boolean" && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name)) {
      capabilities[name] = value;
    }
  }
  return capabilities;
}
function fromMobileConfig(body, fetchedAt) {
  if (!body || !validId(body.tenantId) || typeof body.slug !== "string" || !body.slug) {
    return null;
  }
  const storeTypes = parseStoreTypes(body.storeTypes);
  const capabilities = parseCapabilities(body.capabilities);
  return {
    businessId: body.tenantId,
    slug: body.slug,
    host: (body.tenantHost ?? "").trim().toLowerCase(),
    displayName: cleanDisplayText(body.displayName) || body.slug,
    branding: body.branding ?? {},
    status: normalizeStatus(body.tenantStatus),
    storefrontEnabled: body.storefrontEnabled !== false,
    // Left out when the server did not send them, so a shop saved from an older server looks the same as before.
    ...storeTypes ? { storeTypes } : {},
    ...capabilities ? { capabilities } : {},
    fetchedAt
  };
}
function fromHostResolve(host, body, fetchedAt) {
  if (!body || body.mapped === false || !validId(body.tenantId) || typeof body.slug !== "string" || !body.slug) {
    return null;
  }
  const storeTypes = parseStoreTypes(body.storeTypes);
  const capabilities = parseCapabilities(body.capabilities);
  return {
    businessId: body.tenantId,
    slug: body.slug,
    host,
    displayName: cleanDisplayText(body.branding?.displayName) || cleanDisplayText(body.tenantName) || body.slug,
    branding: body.branding ?? {},
    status: normalizeStatus(body.status),
    storefrontEnabled: body.storefrontEnabled !== false,
    // Left out when the server did not send them, as in fromMobileConfig.
    ...storeTypes ? { storeTypes } : {},
    ...capabilities ? { capabilities } : {},
    fetchedAt
  };
}
function classifyStore(store, audience) {
  const status = normalizeStatus(store.status);
  if (status === "SUSPENDED") {
    return { kind: "unavailable", reason: "suspended", store };
  }
  if (status !== "ACTIVE") {
    return { kind: "unavailable", reason: "not_listed", store };
  }
  if (audience === "shopper" && store.storefrontEnabled === false) {
    return { kind: "unavailable", reason: "storefront_disabled", store };
  }
  return { kind: "found", store };
}
async function lookupHost(base, host, options) {
  const fetched = await getJson(
    `${base}/api/v1/public/host/resolve?host=${encodeURIComponent(host)}`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const failure = transientFailure(fetched);
  if (failure) {
    return { done: failure };
  }
  if (fetched.kind !== "response" || fetched.status !== 200) {
    return { unmapped: true };
  }
  const store = fromHostResolve(host, fetched.body, (/* @__PURE__ */ new Date()).toISOString());
  return store ? { done: classifyStore(store, options.audience) } : { unmapped: true };
}
async function lookupSlug(base, slug, options) {
  return lookupConfig(`${base}/api/v1/public/businesses/${encodeURIComponent(slug)}/mobile`, options);
}
async function lookupConfig(url, options) {
  const fetched = await getJson(url, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const failure = transientFailure(fetched);
  if (failure) {
    return failure;
  }
  if (fetched.kind !== "response" || fetched.status !== 200) {
    return { kind: "not_found" };
  }
  const store = fromMobileConfig(fetched.body, (/* @__PURE__ */ new Date()).toISOString());
  if (!store) {
    return { kind: "offline" };
  }
  return store.host ? classifyStore(store, options.audience) : { kind: "unavailable", reason: "not_listed", store };
}
async function previewStore(input, baseURL, options) {
  const query = parseStoreInput(input);
  if (!query) {
    return { kind: "not_found" };
  }
  const base = baseURL.replace(/\/+$/, "");
  if (query.kind === "slug") {
    return lookupSlug(base, query.slug, options);
  }
  const byHost = await lookupHost(base, query.host, options);
  if ("done" in byHost) {
    return byHost.done;
  }
  const slug = platformSlugFromHost(query.host);
  return slug ? lookupSlug(base, slug, options) : { kind: "not_found" };
}
async function previewStoreByCode(code, baseURL, options) {
  const base = baseURL.replace(/\/+$/, "");
  return lookupConfig(`${base}/api/v1/public/shops/by-code/${encodeURIComponent(code)}`, options);
}
function describeStoreResult(result, input = "") {
  switch (result.kind) {
    case "offline":
      return "Cannot reach the server. Check your connection and try again.";
    case "rate_limited":
      return result.retryAfterSec ? `Too many attempts. Try again in ${result.retryAfterSec} seconds.` : "Too many attempts. Try again in a minute.";
    case "not_found":
      return input.trim() ? `We could not find a shop called "${input.trim()}".` : "Enter your shop name or address.";
    case "unavailable": {
      const name = result.store?.displayName ?? "This shop";
      if (result.reason === "suspended") return `${name} is currently suspended.`;
      if (result.reason === "storefront_disabled") return `${name} is not taking online orders yet.`;
      return `${name} is not available right now.`;
    }
  }
}

// src/tenant.ts
var StoreLookupError = class extends Error {
  result;
  constructor(result, message) {
    super(message);
    this.name = "StoreLookupError";
    this.result = result;
  }
};
var StoreSwitchBlockedError = class extends Error {
  unsent;
  constructor(unsent) {
    super(
      unsent.total === 1 ? "This phone still has 1 unsent sale for the current shop. Send it before switching shops." : `This phone still has ${unsent.total} unsent sales for the current shop. Send them before switching shops.`
    );
    this.name = "StoreSwitchBlockedError";
    this.unsent = unsent;
  }
};
var NOTHING_UNSENT = { total: 0, needsAttention: 0 };
var cache = { loaded: false, store: null };
var mutations = Promise.resolve();
var unsentProbe = null;
var listeners = /* @__PURE__ */ new Set();
onRuntimeReset(() => {
  cache = { loaded: false, store: null };
  mutations = Promise.resolve();
});
function mutate(work) {
  const run = mutations.then(work, work);
  mutations = run.catch(() => void 0);
  return run;
}
function sameStore(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.businessId === b.businessId && a.slug === b.slug && a.host === b.host && a.displayName === b.displayName && a.status === b.status && a.storefrontEnabled === b.storefrontEnabled && JSON.stringify(a.branding ?? null) === JSON.stringify(b.branding ?? null) && JSON.stringify(a.storeTypes ?? null) === JSON.stringify(b.storeTypes ?? null) && capabilityKey(a.capabilities) === capabilityKey(b.capabilities);
}
function capabilityKey(capabilities) {
  return capabilities ? JSON.stringify(Object.entries(capabilities).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0)) : "none";
}
function setActive(next) {
  const changed = !sameStore(cache.store, next);
  cache = { loaded: true, store: next };
  if (changed) {
    for (const listener of [...listeners]) {
      try {
        listener(next);
      } catch {
      }
    }
  }
}
function registerUnsentProbe(probe) {
  unsentProbe = probe;
}
async function getUnsentSummary(tenantId) {
  const id3 = tenantId ?? await getActiveTenantId();
  if (!id3 || !unsentProbe) {
    return NOTHING_UNSENT;
  }
  try {
    return await unsentProbe(id3);
  } catch {
    return NOTHING_UNSENT;
  }
}
function subscribeActiveStore(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function subscribeActiveStoreId(listener) {
  let last = cache.loaded ? { id: cache.store?.businessId ?? null, slug: cache.store?.slug ?? null } : void 0;
  return subscribeActiveStore((store) => {
    const next = { id: store?.businessId ?? null, slug: store?.slug ?? null };
    const previous = last;
    last = next;
    if (previous && previous.id === next.id) {
      return;
    }
    if (previous?.id && next.id && isProvisionalId(previous.id) && previous.slug === next.slug) {
      return;
    }
    listener(next.id);
  });
}
async function loadActiveStore() {
  if (cache.loaded) {
    return cache.store;
  }
  await ensureStorageReady();
  const store = await plain();
  const id3 = await readPointer(store);
  const snapshot = id3 ? await readSnapshot(store, id3) : null;
  if (!cache.loaded) {
    cache = { loaded: true, store: snapshot };
  }
  return cache.store;
}
async function loadStoreById(tenantId) {
  if (!isStorableTenantId(tenantId)) {
    return null;
  }
  const active = await loadActiveStore();
  if (active?.businessId === tenantId) {
    return active;
  }
  await ensureStorageReady();
  return readSnapshot(await plain(), tenantId);
}
async function getActiveTenantId() {
  return (await loadActiveStore())?.businessId ?? null;
}
async function activateInternal(store) {
  assertTenantId(store.businessId);
  const plainStore = await plain();
  await writeSnapshot(plainStore, store);
  await withOutboxLock(async () => {
    await adoptProvisional(store.slug, store.businessId);
    await writePointer(plainStore, store.businessId);
    await rememberTenant(plainStore, store.businessId);
    setActive(store);
  });
}
function activateStore(store) {
  return mutate(async () => {
    await ensureStorageReady();
    await activateInternal(store);
  });
}
function switchStore(to, options = {}) {
  return mutate(async () => {
    await ensureStorageReady();
    const current = await loadActiveStore();
    const leaving = current && (!to || to.businessId !== current.businessId) ? current : null;
    if (leaving) {
      const unsent = await getUnsentSummary(leaving.businessId);
      if (unsent.total > 0 && !options.keepUnsent) {
        return { kind: "blocked", reason: "unsent_sales", unsent };
      }
      if (unsent.total === 0) {
        await secureRemove(secureKey(leaving.businessId, "accessToken"));
        await secureRemove(secureKey(leaving.businessId, "refreshToken"));
      }
    }
    if (to) {
      await activateInternal(to);
    } else {
      await writePointer(await plain(), null);
      setActive(null);
    }
    return { kind: "switched", store: to };
  });
}
async function openStore(input, baseURL, options) {
  const result = await previewStore(input, baseURL, { audience: options.audience });
  if (result.kind !== "found") {
    return result;
  }
  const switched = await switchStore(result.store, { keepUnsent: options.keepUnsent });
  return switched.kind === "blocked" ? switched : { kind: "opened", store: result.store };
}
async function openRememberedStore(tenantId, baseURL, options) {
  const saved = await loadStoreById(tenantId);
  if (!saved) {
    return { kind: "not_found" };
  }
  let target = saved;
  if (classifyStore(saved, options.audience).kind !== "found") {
    const fresh = await previewStore(saved.slug, baseURL, { audience: options.audience });
    if (fresh.kind !== "found" && fresh.kind !== "unavailable") {
      return fresh;
    }
    if (fresh.store && fresh.store.businessId !== saved.businessId && !isProvisionalId(saved.businessId)) {
      return { kind: "not_found" };
    }
    if (fresh.kind !== "found") {
      return fresh;
    }
    target = fresh.store;
  }
  const switched = await switchStore(target, { keepUnsent: options.keepUnsent });
  if (switched.kind === "blocked") {
    return switched;
  }
  if (target === saved) {
    void revalidateActive(baseURL, { audience: options.audience }).catch(() => void 0);
  }
  return { kind: "opened", store: target };
}
async function revalidateActive(baseURL, options) {
  const current = await loadActiveStore();
  if (!current) {
    return null;
  }
  const result = await previewStore(current.slug, baseURL, { audience: options.audience });
  if (result.kind !== "found" && result.kind !== "unavailable") {
    return result;
  }
  const fresh = result.store;
  if (!fresh) {
    return result;
  }
  if (fresh.businessId !== current.businessId && !isProvisionalId(current.businessId)) {
    return { kind: "not_found" };
  }
  const merged = { ...fresh, host: current.host || fresh.host };
  try {
    await mutate(async () => {
      const now = await loadActiveStore();
      if (now && now.businessId === current.businessId) {
        await activateInternal(merged);
      }
    });
  } catch {
  }
  return result.kind === "found" ? { kind: "found", store: merged } : { kind: "unavailable", reason: result.reason, store: merged };
}
async function listRememberedStores() {
  await ensureStorageReady();
  const store = await plain();
  const snapshots = await Promise.all((await readRecents(store)).map((id3) => readSnapshot(store, id3)));
  return snapshots.filter((snapshot) => snapshot !== null);
}
function forgetStore(tenantId, options = {}) {
  return mutate(async () => {
    await ensureStorageReady();
    assertTenantId(tenantId);
    await withOutboxLock(async () => {
      const active = await loadActiveStore();
      await removeNamespace(tenantId, options);
      if (active?.businessId === tenantId) {
        await writePointer(await plain(), null);
        setActive(null);
      }
    });
  });
}
function clearActiveStore() {
  return mutate(async () => {
    await ensureStorageReady();
    await writePointer(await plain(), null);
    setActive(null);
  });
}
function getTenantHeaders(tenant) {
  const headers = {};
  if (tenant.host) {
    headers["X-Tenant-Host"] = tenant.host;
  }
  if (!isProvisionalId(tenant.businessId)) {
    headers["X-Tenant-Id"] = tenant.businessId;
  }
  return headers;
}
function unwrapOpened(result, input = "") {
  if (result.kind === "opened") {
    return result.store;
  }
  if (result.kind === "blocked") {
    throw new StoreSwitchBlockedError(result.unsent);
  }
  throw new StoreLookupError(result, describeStoreResult(result, input));
}
async function resolveShopperStore(input, baseURL) {
  return unwrapOpened(await openStore(input, baseURL, { audience: "shopper" }), input);
}
async function resolveTenant(input, baseURL = "https://api.kiosk.ke") {
  return unwrapOpened(await openStore(input, baseURL, { audience: "staff" }), input);
}
function loadTenant() {
  return loadActiveStore();
}
function clearTenant() {
  return clearActiveStore();
}

// src/deep-link.ts
var SLUG_RE2 = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function isStaffIntent(intent) {
  return intent === "login" || intent === "tenant";
}
function isShopperDeepLinkIntent(intent) {
  return intent === "shop" || intent === "tenant";
}
function isStaffDeepLinkIntent(intent) {
  return isStaffIntent(intent);
}
function extractSlugFromHost(host) {
  const first = host.split(".")[0]?.trim().toLowerCase() ?? "";
  return SLUG_RE2.test(first) ? first : null;
}
function parseCustomSchemeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (scheme === "http" || scheme === "https") {
    return null;
  }
  const intent = parsed.hostname.trim().toLowerCase();
  if (intent !== "shop" && intent !== "login" && intent !== "tenant") {
    return null;
  }
  const slug = parsed.pathname.replace(/^\//, "").split("/")[0]?.trim().toLowerCase() ?? "";
  if (!slug || !SLUG_RE2.test(slug)) {
    return null;
  }
  return { intent, slug, host: null };
}
function parseUniversalLink(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  const host = parsed.hostname.trim().toLowerCase();
  if (!host) {
    return null;
  }
  const path = parsed.pathname.replace(/\/$/, "").toLowerCase();
  if (path === "/shop" || path.endsWith("/shop")) {
    return { intent: "shop", slug: extractSlugFromHost(host), host };
  }
  if (path === "/app" || path.endsWith("/app")) {
    return { intent: "login", slug: extractSlugFromHost(host), host };
  }
  return null;
}
function parseTenantDeepLink(url) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  return parseCustomSchemeUrl(trimmed) ?? parseUniversalLink(trimmed);
}
var MAX_SCAN_LENGTH = 512;
function parseScan(data) {
  const text3 = data.trim();
  if (!text3 || text3.length > MAX_SCAN_LENGTH) {
    return { kind: "unknown" };
  }
  const code = parseShopCodeLink(text3);
  if (code) {
    return { kind: "code", code };
  }
  const link = parseTenantDeepLink(text3);
  if (link && (link.host ?? link.slug)) {
    return { kind: "store", input: link.host ?? link.slug };
  }
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(text3)?.[1]?.toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    return { kind: "unknown" };
  }
  return parseStoreInput(text3) ? { kind: "store", input: text3 } : { kind: "unknown" };
}
async function previewDeepLink(url, baseURL, options) {
  const code = parseShopCodeLink(url);
  if (code) {
    return { intent: "shop", result: await previewStoreByCode(code, baseURL, options) };
  }
  const parsed = parseTenantDeepLink(url);
  const input = parsed?.host ?? parsed?.slug;
  if (!parsed || !input) {
    return null;
  }
  return { intent: parsed.intent, result: await previewStore(input, baseURL, options) };
}
async function resolveTenantFromDeepLink(url, baseURL, options) {
  const parsed = parseTenantDeepLink(url);
  if (!parsed) {
    return null;
  }
  const input = parsed.host ?? parsed.slug;
  if (!input) {
    return null;
  }
  const tenant = unwrapOpened(
    await openStore(input, baseURL, { audience: options.audience, keepUnsent: options.keepUnsent }),
    input
  );
  return { tenant, intent: parsed.intent };
}

// src/platform-config.ts
var import_expo_constants3 = __toESM(require("expo-constants"));
var DEFAULT_PLATFORM_CONFIG = {
  blockedVersions: [],
  directoryEnabled: true,
  shopCodesEnabled: false,
  pairingEnabled: false
};
var SLUG_RE3 = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var MAX_BLOCKED = 50;
function text(value, max = 200) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : void 0;
}
var WEB_ADDRESS_RE = /^https:\/\/[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#]\S*)?$/i;
var STORE_ADDRESS_RE = /^https:\/\/(?:apps\.apple\.com|itunes\.apple\.com|play\.google\.com)(?:[/?#]\S*)?$/i;
var EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
function webAddress(value) {
  const address = text(value, 500);
  return address && WEB_ADDRESS_RE.test(address) ? address : void 0;
}
function storeAddress(value) {
  const address = text(value, 500);
  return address && STORE_ADDRESS_RE.test(address) ? address : void 0;
}
function parseVersion(version) {
  const core = version.trim().split(/[-+]/)[0] ?? "";
  const parts = core.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : Number.NaN);
  return parts.length > 0 && parts.every((part) => Number.isFinite(part)) ? parts : null;
}
function compareVersions(a, b) {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
function parseSupport(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return void 0;
  }
  const { phone, email: email2, whatsapp, url } = raw;
  const support = {};
  const phoneText = text(phone, 40);
  if (phoneText && /^[+\d][\d\s()-]{5,}$/.test(phoneText)) support.phone = phoneText;
  const emailText = text(email2, 120);
  if (emailText && EMAIL_RE.test(emailText)) support.email = emailText;
  const whatsappText = text(whatsapp, 40);
  if (whatsappText && /^[+\d][\d\s()-]{5,}$/.test(whatsappText)) support.whatsapp = whatsappText;
  const link = webAddress(url);
  if (link) support.url = link;
  return Object.keys(support).length > 0 ? support : void 0;
}
function parsePlatformConfig(body) {
  const config = { ...DEFAULT_PLATFORM_CONFIG, blockedVersions: [] };
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return config;
  }
  const raw = body;
  if (typeof raw.schemaVersion === "number" && Number.isFinite(raw.schemaVersion)) {
    config.schemaVersion = raw.schemaVersion;
  }
  const min = text(raw.minAppVersion, 40);
  if (min && parseVersion(min)) {
    config.minAppVersion = min;
  }
  if (Array.isArray(raw.blockedVersions)) {
    config.blockedVersions = raw.blockedVersions.map((entry) => text(entry, 40)).filter((entry) => Boolean(entry) && parseVersion(entry) !== null).slice(0, MAX_BLOCKED);
  }
  const support = parseSupport(raw.support);
  if (support) {
    config.support = support;
  }
  config.directoryEnabled = raw.directoryEnabled !== false;
  config.shopCodesEnabled = raw.shopCodesEnabled === true;
  config.pairingEnabled = raw.pairingEnabled === true;
  const demo = text(raw.demoShop, 63)?.toLowerCase();
  if (demo && SLUG_RE3.test(demo)) {
    config.demoShop = demo;
  }
  if (raw.storeLinks && typeof raw.storeLinks === "object" && !Array.isArray(raw.storeLinks)) {
    const { ios, android } = raw.storeLinks;
    const links = { ...storeAddress(ios) ? { ios: storeAddress(ios) } : {}, ...storeAddress(android) ? { android: storeAddress(android) } : {} };
    if (Object.keys(links).length > 0) {
      config.storeLinks = links;
    }
  }
  return config;
}
async function fetchPlatformConfig(baseURL, options = {}) {
  const base = baseURL.replace(/\/+$/, "");
  const fetched = await getJson(`${base}/api/v1/platform/mobile-schema-version`, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (fetched.kind !== "response" || fetched.status !== 200 || fetched.body === null) {
    return null;
  }
  return parsePlatformConfig(fetched.body);
}
function getAppVersion() {
  const version = import_expo_constants3.default.expoConfig?.version;
  return typeof version === "string" && version.trim() ? version.trim() : void 0;
}
function updateStateFor(appVersion, config, platform) {
  const current = appVersion ? parseVersion(appVersion) : null;
  if (!current || !config) {
    return { required: false };
  }
  const storeUrl = platform === "ios" ? config.storeLinks?.ios : config.storeLinks?.android;
  const link = storeUrl ? { storeUrl } : {};
  const blocked = config.blockedVersions.some((entry) => {
    const version = parseVersion(entry);
    return version !== null && compareVersions(current, version) === 0;
  });
  if (blocked) {
    return { required: true, reason: "blocked", ...config.minAppVersion ? { minAppVersion: config.minAppVersion } : {}, ...link };
  }
  const minimum = config.minAppVersion ? parseVersion(config.minAppVersion) : null;
  if (minimum && compareVersions(current, minimum) < 0) {
    return { required: true, reason: "below_minimum", minAppVersion: config.minAppVersion, ...link };
  }
  return { required: false };
}

// src/store-directory.ts
var MIN_SEARCH_LENGTH = 2;
var MAX_SEARCH_LENGTH = 60;
var MAX_HITS = 20;
var SLUG_RE4 = /^[a-z0-9]+(-[a-z0-9]+)*$/;
var HOST_RE3 = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/;
function cleanSearchText(input) {
  return Array.from(input.replace(/\s+/g, " ").trim()).slice(0, MAX_SEARCH_LENGTH).join("").trim();
}
function parseHit(row) {
  if (!row || typeof row !== "object") {
    return null;
  }
  const { slug, name, logoUrl, primaryHost } = row;
  if (typeof slug !== "string" || !SLUG_RE4.test(slug)) {
    return null;
  }
  const label = cleanDisplayText(name, MAX_DISPLAY_NAME_LENGTH);
  if (!label) {
    return null;
  }
  const hit = { slug, name: label };
  if (typeof logoUrl === "string" && /^https:\/\//i.test(logoUrl.trim())) {
    hit.logoUrl = logoUrl.trim();
  }
  const host = typeof primaryHost === "string" ? primaryHost.trim().toLowerCase() : "";
  if (host && HOST_RE3.test(host)) {
    hit.host = host;
  }
  return hit;
}
function parseHits(body) {
  if (!Array.isArray(body)) {
    return [];
  }
  const seen = /* @__PURE__ */ new Set();
  const hits = [];
  for (const row of body) {
    const hit = parseHit(row);
    if (hit && !seen.has(hit.slug)) {
      seen.add(hit.slug);
      hits.push(hit);
    }
    if (hits.length >= MAX_HITS) {
      break;
    }
  }
  return hits;
}
async function searchStores(input, baseURL, options = {}) {
  const query = cleanSearchText(input);
  if (query.length < MIN_SEARCH_LENGTH) {
    return { kind: "too_short" };
  }
  const base = baseURL.replace(/\/+$/, "");
  const fetched = await getJson(
    `${base}/api/v1/public/shops/search?q=${encodeURIComponent(query)}`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const failure = transientFailure(fetched);
  if (failure) {
    return failure.kind === "rate_limited" ? { kind: "rate_limited", retryAfterSec: failure.retryAfterSec } : { kind: "offline" };
  }
  if (fetched.kind !== "response") {
    return { kind: "offline" };
  }
  if (fetched.status === 200) {
    return { kind: "results", query, hits: parseHits(fetched.body) };
  }
  return fetched.status === 400 ? { kind: "results", query, hits: [] } : { kind: "unavailable" };
}

// src/hooks/use-tenant-deep-link.ts
var import_react = require("react");
var import_react_native = require("react-native");
function useTenantDeepLink(onUrl) {
  const handlerRef = (0, import_react.useRef)(onUrl);
  handlerRef.current = onUrl;
  (0, import_react.useEffect)(() => {
    const handle = (url) => {
      if (!url?.trim()) {
        return;
      }
      void handlerRef.current(url);
    };
    void import_react_native.Linking.getInitialURL().then(handle);
    const subscription = import_react_native.Linking.addEventListener("url", (event) => {
      handle(event.url);
    });
    return () => {
      subscription.remove();
    };
  }, []);
}

// src/idempotency.ts
function randomHex(byteCount) {
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(byteCount);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  let result = "";
  for (let i = 0; i < byteCount; i++) {
    result += Math.floor(Math.random() * 256).toString(16).padStart(2, "0");
  }
  return result;
}
function generateIdempotencyKey() {
  return `${Date.now().toString(36)}-${randomHex(8)}`;
}
function resolveIdempotencyKey(options = {}) {
  if (options.idempotencyKey) return options.idempotencyKey;
  return options.idempotent ? generateIdempotencyKey() : void 0;
}

// src/tenant-data.ts
async function resolveId(tenantId) {
  return tenantId ?? await getActiveTenantId();
}
async function readTenantSecret(field, tenantId) {
  const id3 = await resolveId(tenantId);
  if (!id3) return null;
  await ensureStorageReady();
  return secureGet(secureKey(id3, field));
}
async function writeTenantSecret(field, value, tenantId) {
  const id3 = await resolveId(tenantId);
  if (!id3) return false;
  await ensureStorageReady();
  await securePut(secureKey(id3, field), value);
  return true;
}
async function removeTenantSecret(field, tenantId) {
  const id3 = await resolveId(tenantId);
  if (!id3) return;
  await ensureStorageReady();
  await secureRemove(secureKey(id3, field));
}
async function readTenantValue(field, tenantId) {
  const id3 = await resolveId(tenantId);
  if (!id3) return null;
  await ensureStorageReady();
  return (await plain()).get(plainKey(id3, field));
}
async function writeTenantValue(field, value, tenantId) {
  const id3 = await resolveId(tenantId);
  if (!id3) return false;
  await ensureStorageReady();
  await (await plain()).set(plainKey(id3, field), value);
  return true;
}
async function removeTenantValue(field, tenantId) {
  const id3 = await resolveId(tenantId);
  if (!id3) return;
  await ensureStorageReady();
  await (await plain()).remove(plainKey(id3, field));
}

// src/auth.ts
var sessionsEnded = /* @__PURE__ */ new Set();
function markSessionEnded(tenantId) {
  sessionsEnded.add(tenantId);
}
function sessionWasEnded(tenantId) {
  return sessionsEnded.has(tenantId);
}
async function storeTokens(tokens, tenantId) {
  const id3 = tenantId ?? await getActiveTenantId();
  if (!id3) {
    throw new Error("Select a store first before signing in.");
  }
  if (!await loadStoreById(id3)) {
    return;
  }
  await writeTenantSecret("accessToken", tokens.accessToken, id3);
  await writeTenantSecret("refreshToken", tokens.refreshToken, id3);
  sessionsEnded.delete(id3);
}
async function getAccessToken(tenantId) {
  return readTenantSecret("accessToken", tenantId);
}
async function getRefreshToken(tenantId) {
  return readTenantSecret("refreshToken", tenantId);
}
async function clearTokens(tenantId) {
  await removeTenantSecret("accessToken", tenantId);
  await removeTenantSecret("refreshToken", tenantId);
}

// src/till-device.ts
var TILL_DEVICE_HEADER = "X-Till-Device-Id";
function randomTillId() {
  const rand = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `till-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return rand;
}
var creating = /* @__PURE__ */ new Map();
async function getOrCreateTillDeviceId(tenantId) {
  try {
    const id3 = tenantId ?? await getActiveTenantId();
    if (!id3) {
      return "";
    }
    const existing = (await readTenantSecret("tillDeviceId", id3))?.trim();
    if (existing) {
      return existing;
    }
    let pending = creating.get(id3);
    if (!pending) {
      pending = (async () => {
        const again = (await readTenantSecret("tillDeviceId", id3))?.trim();
        if (again) {
          return again;
        }
        const created = randomTillId();
        await writeTenantSecret("tillDeviceId", created, id3);
        return created;
      })().finally(() => {
        creating.delete(id3);
      });
      creating.set(id3, pending);
    }
    return await pending;
  } catch {
    return "";
  }
}

// src/api-client.ts
async function apiRequest(config, method, path, options = {}) {
  const url = `${config.baseURL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-Id": generateIdempotencyKey()
  };
  if (!options.public) {
    const tenant = config.getTenant ? await config.getTenant() : await loadActiveStore();
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
      const accessToken = await getAccessToken(tenant.businessId);
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      const tillId = await getOrCreateTillDeviceId(tenant.businessId);
      if (tillId) {
        headers[TILL_DEVICE_HEADER] = tillId;
      }
    }
  }
  if (options.idempotent) {
    headers["Idempotency-Key"] = generateIdempotencyKey();
  }
  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
async function publicApiRequest(baseURL, method, path, options = {}) {
  const url = `${baseURL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-Id": generateIdempotencyKey()
  };
  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// src/auth-tokens.ts
var ACCESS_COOKIE = "ub.access";
var REFRESH_COOKIE = "ub.refresh";
var NATIVE_KIOSK_CLIENT_HEADER = "X-Kiosk-Client";
var NATIVE_KIOSK_CLIENT_VALUE = "native";
function decodeCookieValue(raw) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
function readSetCookieLines(headers) {
  const withGet = headers;
  if (typeof withGet.getSetCookie === "function") {
    return withGet.getSetCookie();
  }
  const combined = headers.get("set-cookie");
  if (!combined) {
    return [];
  }
  return combined.split(/,(?=\s*[A-Za-z0-9!#$%&'*+\-.^_`|~]+=)/);
}
function cookieNameValue(setCookieLine, name) {
  const first = setCookieLine.trim().split(";")[0] ?? "";
  const eq = first.indexOf("=");
  if (eq <= 0) {
    return null;
  }
  if (first.slice(0, eq).trim() !== name) {
    return null;
  }
  const raw = first.slice(eq + 1).trim();
  return raw ? decodeCookieValue(raw) : null;
}
function readCookieFromSetCookie(headers, name) {
  for (const line of readSetCookieLines(headers)) {
    const value = cookieNameValue(line, name);
    if (value) {
      return value;
    }
  }
  return "";
}
function readAuthTokens(payload, headers) {
  const access = payload.accessToken?.trim() || payload.access_token?.trim() || readCookieFromSetCookie(headers, ACCESS_COOKIE);
  const refresh = payload.refreshToken?.trim() || payload.refresh_token?.trim() || readCookieFromSetCookie(headers, REFRESH_COOKIE);
  return { accessToken: access, refreshToken: refresh };
}
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function pinLoginBranchId(branchId) {
  const trimmed = branchId?.trim();
  if (!trimmed || !UUID_RE.test(trimmed)) {
    return void 0;
  }
  return trimmed;
}

// src/problem.ts
var GENERIC_PROBLEM_TITLES = /* @__PURE__ */ new Set([
  "",
  "Bad Request",
  "Unauthorized",
  "Forbidden",
  "Not Found",
  "Internal Server Error"
]);
function parseProblem(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload;
  let title = typeof record.title === "string" ? record.title.trim() : "";
  const springMessage = typeof record.message === "string" ? record.message.trim() : "";
  if (!title && springMessage) {
    title = springMessage;
  }
  if (!title && typeof record.error === "string") {
    title = record.error.trim();
  }
  const type = typeof record.type === "string" ? record.type : "about:blank";
  const status = typeof record.status === "number" && Number.isFinite(record.status) ? record.status : 500;
  const detail = typeof record.detail === "string" ? record.detail : void 0;
  const code = typeof record.code === "string" ? record.code : void 0;
  const requirement = typeof record.requirement === "string" ? record.requirement : void 0;
  const hint = typeof record.hint === "string" ? record.hint : void 0;
  return {
    type,
    title,
    status,
    detail,
    code,
    ...requirement !== void 0 ? { requirement } : {},
    ...hint !== void 0 ? { hint } : {}
  };
}
function formatApiProblemMessage(payload) {
  const problem = parseProblem(payload);
  const title = problem != null && problem.title.trim().length > 0 ? problem.title.trim() : "Request failed";
  const detail = problem?.detail?.trim();
  if (detail && detail.length > 0) {
    if (GENERIC_PROBLEM_TITLES.has(title)) {
      return detail;
    }
    return `${title}: ${detail}`;
  }
  return title.length > 0 ? title : "Request failed";
}
var ApiError = class extends Error {
  status;
  code;
  requirement;
  hint;
  /**
   * Set when the answer was not the app's own: a web page or nothing at all, which is what a firewall, a proxy or a
   * login page in the way sends. Absent for anything the app wrote. Code that has to decide whether the server really
   * turned a request down reads this, never the words.
   */
  foreign;
  /**
   * The problem's machine name as the server wrote it (`urn:problem:data-integrity`), when it gave one. Code that has
   * to tell one kind of "no" from another reads this, never the words.
   */
  type;
  constructor(message, info) {
    super(message);
    this.name = "ApiError";
    this.status = info.status;
    if (info.code !== void 0) this.code = info.code;
    if (info.requirement !== void 0) this.requirement = info.requirement;
    if (info.hint !== void 0) this.hint = info.hint;
    if (info.foreign) this.foreign = true;
    if (typeof info.type === "string" && info.type !== "" && info.type !== "about:blank") this.type = info.type;
  }
};
function isApiError(error) {
  if (error instanceof ApiError) {
    return true;
  }
  return error instanceof Error && error.name === "ApiError" && typeof error.status === "number";
}
async function readApiError(response) {
  const text3 = await response.text().catch(() => "");
  if (!text3) {
    return new ApiError(`Request failed (${response.status})`, { status: response.status, foreign: true });
  }
  try {
    const payload = JSON.parse(text3);
    const problem = parseProblem(payload);
    return new ApiError(formatApiProblemMessage(payload), {
      status: response.status,
      code: problem?.code,
      requirement: problem?.requirement,
      hint: problem?.hint,
      type: problem?.type
    });
  } catch {
    return new ApiError(text3, { status: response.status, foreign: true });
  }
}
async function readApiErrorMessage(response) {
  return (await readApiError(response)).message;
}

// src/staff-user.ts
var MAX_PERMISSIONS = 500;
var PERMISSION_RE = /^[a-z0-9][a-z0-9_.:-]{0,79}$/;
var MAX_ID_LENGTH = 64;
function id(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_ID_LENGTH ? trimmed : null;
}
function email(value) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 191) : "";
}
function parseMe(payload) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload;
  const userId = id(record.id);
  if (!userId) return null;
  const roleless = record.role === null || record.role === void 0;
  const role = record.role && typeof record.role === "object" ? record.role : null;
  const roleKey = typeof role?.key === "string" ? role.key.trim().toLowerCase().slice(0, 80) : "";
  if (!roleless && !roleKey) return null;
  const permissions = !roleless && Array.isArray(record.permissions) ? [
    ...new Set(
      record.permissions.filter((value) => typeof value === "string").map((value) => value.trim().toLowerCase()).filter((value) => PERMISSION_RE.test(value))
    )
  ].slice(0, MAX_PERMISSIONS) : [];
  const itemTypeIds = Array.isArray(record.itemTypeIds) ? [
    ...new Set(
      record.itemTypeIds.filter((value) => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0 && value.length <= MAX_ID_LENGTH)
    )
  ] : [];
  return {
    id: userId,
    email: email(record.email),
    name: cleanDisplayText(record.name, 60),
    branchId: id(record.branchId),
    roleKey,
    roleName: roleless ? "" : cleanDisplayText(role?.name, 60) || roleKey,
    permissions,
    itemTypeIds,
    hasPin: record.hasPin === true
  };
}
function parseSignedInUser(payload) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload;
  const userId = id(record.id);
  if (!userId) return null;
  return {
    id: userId,
    email: email(record.email),
    name: cleanDisplayText(record.name, 60),
    branchId: id(record.branchId)
  };
}

// src/auth-service.ts
var SIGN_IN_TIMEOUT_MS = 3e4;
var BRANCHES_TIMEOUT_MS = 2e4;
var inFlightRefresh = /* @__PURE__ */ new Map();
async function authFetch(baseURL, tenant, path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-Id": generateIdempotencyKey(),
    [NATIVE_KIOSK_CLIENT_HEADER]: NATIVE_KIOSK_CLIENT_VALUE,
    ...getTenantHeaders(tenant)
  };
  const tillId = await getOrCreateTillDeviceId(tenant.businessId);
  if (tillId) {
    headers[TILL_DEVICE_HEADER] = tillId;
  }
  if (options.accessToken) {
    headers["Authorization"] = `Bearer ${options.accessToken}`;
  } else if (options.includeAccessToken !== false) {
    const accessToken = await getAccessToken(tenant.businessId);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
  }
  const limit = !options.signal && options.timeoutMs ? new AbortController() : null;
  const timer = limit ? setTimeout(() => limit.abort(), options.timeoutMs) : null;
  try {
    return await fetch(`${baseURL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : void 0,
      ...options.signal ? { signal: options.signal } : limit ? { signal: limit.signal } : {}
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function requireTenant(message) {
  const tenant = await loadActiveStore();
  if (!tenant) {
    throw new Error(message);
  }
  return tenant;
}
async function readSession(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  return { ...readAuthTokens(payload, response.headers), user: parseSignedInUser(payload?.user) };
}
async function readSessionTokens(response) {
  const { accessToken, refreshToken } = await readSession(response);
  return { accessToken, refreshToken };
}
var REVOKE_TIMEOUT_MS = 8e3;
function revokeInBackground(baseURL, tenant, tokens, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endWith = (accessToken) => authFetch(baseURL, tenant, "/api/v1/auth/logout", { method: "POST", accessToken, signal: controller.signal });
  void (async () => {
    const first = tokens.accessToken ? await endWith(tokens.accessToken) : null;
    if (first && first.status !== 401) return;
    if (!tokens.refreshToken) return;
    const renewed = await authFetch(baseURL, tenant, "/api/v1/auth/refresh", {
      method: "POST",
      body: { refreshToken: tokens.refreshToken },
      includeAccessToken: false,
      signal: controller.signal
    });
    if (!renewed.ok) return;
    const { accessToken } = await readSessionTokens(renewed);
    if (accessToken) await endWith(accessToken);
  })().catch(() => void 0).finally(() => clearTimeout(timer));
}
async function keepSignIn(baseURL, tenant, tokens) {
  const current = await loadActiveStore();
  if (current?.slug === tenant.slug) {
    await storeTokens(tokens, tenant.businessId);
    return;
  }
  revokeInBackground(baseURL, tenant, tokens, REVOKE_TIMEOUT_MS);
  throw Object.assign(new Error("The shop was changed while signing in."), { name: "AbortError" });
}
async function loginWithPassword(baseURL, email2, password) {
  const tenant = await requireTenant("Select a store first before signing in.");
  const response = await authFetch(baseURL, tenant, "/api/v1/auth/login", {
    method: "POST",
    body: { email: email2, password },
    includeAccessToken: false,
    timeoutMs: SIGN_IN_TIMEOUT_MS
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  const { user, ...tokens } = await readSession(response);
  if (!tokens.accessToken) {
    throw new Error("Login failed: no access token");
  }
  await keepSignIn(baseURL, tenant, tokens);
  return { user };
}
async function loginWithPin(baseURL, email2, pin, branchId) {
  const tenant = await requireTenant("Select a store first before signing in.");
  const body = { email: email2, pin };
  const resolvedBranch = pinLoginBranchId(branchId);
  if (resolvedBranch) {
    body.branchId = resolvedBranch;
  }
  const response = await authFetch(baseURL, tenant, "/api/v1/auth/login-pin", {
    method: "POST",
    body,
    includeAccessToken: false,
    timeoutMs: SIGN_IN_TIMEOUT_MS
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  const { user, ...tokens } = await readSession(response);
  if (!tokens.accessToken) {
    throw new Error("PIN login failed: no access token");
  }
  await keepSignIn(baseURL, tenant, tokens);
  return { user };
}
async function refreshAccessToken(baseURL, tenant) {
  const shop = tenant ?? await loadActiveStore();
  if (!shop) {
    return { kind: "rejected" };
  }
  const running = inFlightRefresh.get(shop.businessId);
  if (running) {
    return running;
  }
  const started = performRefreshOnce(baseURL, shop).finally(() => {
    inFlightRefresh.delete(shop.businessId);
  });
  inFlightRefresh.set(shop.businessId, started);
  return started;
}
async function performRefreshOnce(baseURL, tenant) {
  if (sessionWasEnded(tenant.businessId)) {
    return { kind: "rejected" };
  }
  const refreshToken = await getRefreshToken(tenant.businessId);
  let response;
  try {
    response = await authFetch(baseURL, tenant, "/api/v1/auth/refresh", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
      includeAccessToken: false
    });
  } catch {
    return { kind: "network" };
  }
  if (response.status >= 500 || response.status === 408 || response.status === 429) {
    return { kind: "network" };
  }
  if (!response.ok) {
    return refused(tenant, refreshToken);
  }
  let tokens;
  try {
    tokens = await readSessionTokens(response);
  } catch {
    return { kind: "network" };
  }
  if (!tokens.accessToken) {
    return refused(tenant, refreshToken);
  }
  if (await sessionChanged(tenant, refreshToken)) {
    return { kind: "superseded" };
  }
  await storeTokens(
    {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || refreshToken || ""
    },
    tenant.businessId
  );
  return { kind: "ok" };
}
async function sessionChanged(tenant, sentRefreshToken) {
  return await getRefreshToken(tenant.businessId) !== sentRefreshToken;
}
async function refused(tenant, sentRefreshToken) {
  if (await sessionChanged(tenant, sentRefreshToken)) {
    return { kind: "superseded" };
  }
  await clearTokens(tenant.businessId);
  return { kind: "rejected" };
}
async function registerAccount(baseURL, name, email2, password, opts) {
  const tenant = await requireTenant("Select a store first before creating an account.");
  const body = { name, email: email2, password };
  const token = opts?.staffInviteToken?.trim();
  if (token) {
    body.staffInviteToken = token;
  }
  const response = await authFetch(baseURL, tenant, "/api/v1/auth/register", {
    method: "POST",
    body,
    includeAccessToken: false
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  return response.json();
}
async function resendVerificationEmail(baseURL, email2) {
  const tenant = await requireTenant("Select a store first.");
  const response = await authFetch(baseURL, tenant, "/api/v1/auth/resend-verification", {
    method: "POST",
    body: { email: email2 },
    includeAccessToken: false
  });
  if (!response.ok) {
    throw await readApiError(response);
  }
  if (response.status === 204) {
    return {};
  }
  return response.json();
}
async function logout(baseURL) {
  const tenant = await loadActiveStore();
  if (!tenant) {
    return;
  }
  markSessionEnded(tenant.businessId);
  try {
    await authFetch(baseURL, tenant, "/api/v1/auth/logout", { method: "POST" });
  } finally {
    await clearTokens(tenant.businessId);
  }
}
async function endSession(baseURL, options = {}) {
  const tenant = await loadActiveStore();
  if (!tenant) {
    return;
  }
  markSessionEnded(tenant.businessId);
  const accessToken = await getAccessToken(tenant.businessId);
  const refreshToken = await getRefreshToken(tenant.businessId);
  await clearTokens(tenant.businessId);
  if (!accessToken && !refreshToken) {
    return;
  }
  revokeInBackground(baseURL, tenant, { accessToken, refreshToken }, options.timeoutMs ?? REVOKE_TIMEOUT_MS);
}
async function fetchBranches(baseURL) {
  const tenant = await requireTenant("Select a store first.");
  const response = await authFetch(baseURL, tenant, "/api/v1/auth/branches", { timeoutMs: BRANCHES_TIMEOUT_MS });
  if (!response.ok) {
    throw new ApiError(`Failed to fetch branches: ${response.status}`, { status: response.status });
  }
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload.branches ?? [];
}
async function resolveTenantByEmail(baseURL, email2) {
  const response = await fetch(
    `${baseURL}/api/v1/public/host/resolve-by-email?email=${encodeURIComponent(email2)}`
  );
  if (!response.ok) {
    throw new Error(`Tenant not found for email: ${response.status}`);
  }
  return response.json();
}

// src/create-api-client.ts
function pinnedTo(api, tenantId) {
  if (api.tenantId === tenantId) return api;
  return api.forTenant?.(tenantId) ?? api;
}
function createApiClient(options) {
  async function resolveTenant2() {
    if (options.getTenant) {
      return options.getTenant();
    }
    return options.tenantId ? loadStoreById(options.tenantId) : loadActiveStore();
  }
  async function request(method, path, body, opts = {}) {
    const url = `${options.baseURL}${path}`;
    const headers = {
      "Content-Type": "application/json",
      "X-Correlation-Id": generateIdempotencyKey()
    };
    const tenant = opts.tenant !== void 0 ? opts.tenant : await resolveTenant2();
    const tenantId = tenant?.businessId ?? null;
    if (tenant) {
      Object.assign(headers, getTenantHeaders(tenant));
    }
    const accessToken = tenantId ? await getAccessToken(tenantId) : null;
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    const idempotencyKey = resolveIdempotencyKey(opts);
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    const tillId = tenantId ? await getOrCreateTillDeviceId(tenantId) : "";
    if (tillId) {
      headers[TILL_DEVICE_HEADER] = tillId;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body !== void 0 ? JSON.stringify(body) : void 0
    });
    if (response.status === 401 && !opts.retried && tenant) {
      const result = await refreshAccessToken(options.baseURL, tenant);
      if (result.kind === "ok") {
        return request(method, path, body, { ...opts, idempotencyKey, retried: true, tenant });
      }
      if (result.kind === "rejected" && await getActiveTenantId() === tenant.businessId) {
        options.onAuthFailed?.();
      }
    }
    if (!response.ok) {
      throw await readApiError(response);
    }
    if (response.status === 204) {
      return void 0;
    }
    return response.json();
  }
  return {
    tenantId: options.tenantId,
    forTenant: (tenantId) => createApiClient({ ...options, getTenant: void 0, tenantId }),
    get: (path) => request("GET", path),
    post: (path, body, opts) => request("POST", path, body, { ...opts }),
    put: (path, body, opts) => request("PUT", path, body, { ...opts }),
    patch: (path, body, opts) => request("PATCH", path, body, { ...opts }),
    delete: (path, opts) => request("DELETE", path, void 0, { ...opts })
  };
}

// src/embedded-tenant.ts
async function bootstrapStore(baseURL, options = { audience: "staff" }) {
  const embeddedSlug = getEmbeddedTenantSlug();
  const bakedHost = tenantHost();
  const saved = await loadActiveStore();
  if (saved) {
    const slugMismatch = Boolean(embeddedSlug && saved.slug.toLowerCase() !== embeddedSlug.toLowerCase());
    const hostMismatch = Boolean(bakedHost && saved.host && saved.host.toLowerCase() !== bakedHost);
    if (!slugMismatch && !hostMismatch) {
      void revalidateActive(baseURL, options).catch(() => void 0);
      return { kind: "ready", store: saved, source: "device" };
    }
    await clearActiveStore();
  }
  const input = bakedHost ?? embeddedSlug;
  if (!input) {
    return { kind: "picker" };
  }
  const result = await previewStore(input, baseURL, options);
  if (result.kind !== "found") {
    return result;
  }
  await activateStore(result.store);
  return { kind: "ready", store: result.store, source: "server" };
}
async function bootstrapTenant(baseURL, options = {}) {
  const result = await bootstrapStore(baseURL, { audience: options.audience ?? "staff" });
  if (result.kind === "ready") {
    return result.store;
  }
  if (result.kind === "picker") {
    return null;
  }
  throw new StoreLookupError(result, describeStoreResult(result, getEmbeddedTenantSlug() ?? ""));
}

// src/mobile-distribution.ts
async function fetchPublicMobileConfig(baseURL, slug) {
  return publicApiRequest(
    baseURL,
    "GET",
    `/api/v1/public/businesses/${encodeURIComponent(slug)}/mobile`
  );
}

// src/staff-session.ts
async function fetchMe(api) {
  const user = parseMe(await api.get("/api/v1/me"));
  if (!user) {
    throw new Error("Could not read your account. Try again.");
  }
  return user;
}
function shiftsAreDisabled(shop) {
  return shop?.capabilities?.shiftsDisabled === true;
}
function readShiftsDisabled(body) {
  if (!body || typeof body !== "object") return false;
  const flags = body.featureFlags;
  if (!flags || typeof flags !== "object") return false;
  return flags["shifts.disabled"] === true;
}
async function fetchShiftsDisabled(baseURL, host, options = {}) {
  const address = host?.trim();
  if (!address) return false;
  const base = baseURL.replace(/\/+$/, "");
  const fetched = await getJson(
    `${base}/api/v1/public/host/resolve?host=${encodeURIComponent(address)}`,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  if (fetched.kind !== "response" || fetched.status !== 200) return false;
  return readShiftsDisabled(fetched.body);
}

// src/role-gate.ts
var STAFF_APPS = ["cashier", "grocery", "stock", "admin"];
var APP_NAMES = {
  cashier: "Cashier",
  grocery: "Grocery",
  stock: "Stock",
  admin: "Admin"
};
var APP_JOBS = {
  cashier: "the till",
  grocery: "counter invoices",
  stock: "counting and moving stock",
  admin: "running the shop"
};
var APP_ENTRY_PERMISSIONS = {
  cashier: [
    "sales.sell",
    "sales.refund.create",
    "sales.void.any",
    "sales.void.own",
    "sales.payment.adjust",
    "sales.weighed.refund",
    "shifts.open",
    "shifts.close",
    "shifts.update",
    "pos.drafts.write"
  ],
  grocery: ["grocery.invoices.create", "grocery.invoices.read", "grocery.invoices.pay", "grocery.invoices.cancel"],
  stock: ["stocktake.read", "stocktake.run", "inventory.read", "inventory.write"],
  admin: [
    "finance.reports.read",
    "reports.sales.read",
    "reports.inventory.read",
    "storefront.orders.read",
    "users.list",
    "business.manage_settings"
  ]
};
function fitsApp(app, permissions) {
  const held = new Set(permissions);
  return APP_ENTRY_PERMISSIONS[app].some((permission) => held.has(permission));
}
function appsThatFit(permissions) {
  return STAFF_APPS.filter((app) => fitsApp(app, permissions));
}
var BRANCH_LOCKED_ROLE_KEYS = ["stock_manager", "cashier", "grocery_clerk", "butcher_cashier"];
function isBranchLockedRole(roleKey) {
  return typeof roleKey === "string" && BRANCH_LOCKED_ROLE_KEYS.includes(roleKey.trim().toLowerCase());
}
function webHomeForRole(roleKey) {
  switch (roleKey.trim().toLowerCase()) {
    case "owner":
    case "admin":
      return { where: "the shop overview", path: "/overview" };
    case "manager":
    case "viewer":
      return { where: "the business pages", path: "/business" };
    case "cashier":
      return { where: "the shifts page", path: "/shifts" };
    case "butcher_cashier":
      return { where: "the butchery counter", path: "/butcher" };
    case "grocery_clerk":
      return { where: "the invoices page", path: "/clerk" };
    case "stock_manager":
      return { where: "the stock pages", path: "/inventory/stock?view=levels" };
    case "pharmacist":
      return { where: "the pharmacy", path: "/pharmacy" };
    case "waiter":
      return { where: "the restaurant floor", path: "/restaurant/floor" };
    case "kitchen_staff":
      return { where: "the kitchen screen", path: "/restaurant/kitchen" };
    case "service_staff":
      return { where: "your earnings page", path: "/my-earnings" };
    case "clinician":
    case "nurse":
    case "clinic_receptionist":
      return { where: "the clinic", path: "/clinic" };
    default:
      return { where: "the web", path: "/" };
  }
}

// src/setup-required.ts
var REQUIREMENTS = ["branch", "shift", "till", "dispensing"];
function asSetupRequired(error) {
  if (!isApiError(error) || error.code !== "setup_required") return null;
  if (!error.requirement || !REQUIREMENTS.includes(error.requirement)) return null;
  return {
    requirement: error.requirement,
    ...error.hint ? { hint: error.hint } : {}
  };
}
function describeFailure(error, fallback, context = {}) {
  const needed = asSetupRequired(error);
  if (needed) {
    const setup = describeSetup(needed, context);
    return { title: setup.title, body: setup.body, setup };
  }
  const own = error instanceof Error ? cleanDisplayText(error.message, 200) : "";
  return { title: fallback.title, body: own && !own.startsWith("<") ? own : fallback.body };
}
function describeSetup(needed, context = {}) {
  const { requirement, hint } = needed;
  const web = plainHost(context.web) ?? "the web";
  switch (requirement) {
    case "branch":
      if (hint === "none") {
        return {
          requirement,
          title: "This shop has no branch yet",
          body: `Add a branch on ${web}, then come back.`,
          action: "finish_on_web"
        };
      }
      if (hint === "assign") {
        return {
          requirement,
          title: "You are not on a branch yet",
          body: "Ask your manager to put you on a branch, then sign in again.",
          action: "ask_manager"
        };
      }
      return {
        requirement,
        title: "Choose a branch",
        body: "Pick the branch you are working at.",
        action: "pick_branch"
      };
    case "shift":
      if (context.shiftsDisabled || context.app !== "cashier") {
        return {
          requirement,
          title: "A shift is needed",
          body: `This needs an open shift. Open one on ${web}, then try again.`,
          action: "finish_on_web"
        };
      }
      return {
        requirement,
        title: "Open a shift to start selling",
        body: "Open a shift first, then try again.",
        action: "open_shift"
      };
    case "till":
      return {
        requirement,
        title: "This phone is not approved as a till",
        body: context.pairingEnabled ? `Scan the pairing QR from your manager, or ask them to approve this phone on ${web}.` : `Ask your manager to approve this phone on ${web}, then try again.`,
        action: context.pairingEnabled ? "pair" : "ask_manager"
      };
    case "dispensing":
      return {
        requirement,
        title: "This sale needs a pharmacist",
        body: `Medicines that need a dispensing record are finished on ${web}, not in this app.`,
        action: "finish_on_web"
      };
  }
}

// src/till-status.ts
function interpretTillAnswer(answer, registeredHere) {
  switch (answer) {
    case "registered":
      return "registered";
    case "not_found":
      return registeredHere ? "removed" : "not_registered";
    case "shop_off":
      return "shop_off";
    case "failed":
      return "unknown";
  }
}
async function rememberTillRegistered(tenantId, branchId) {
  await writeTenantValue("tillSeen", branchId, tenantId);
}
async function forgetTillRegistered(tenantId) {
  await removeTenantValue("tillSeen", tenantId);
}
async function checkTillRegistration(api, tenantId, branchId) {
  let answer;
  try {
    await api.get(`/api/v1/till-devices/me?branchId=${encodeURIComponent(branchId)}`);
    answer = "registered";
  } catch (error) {
    answer = isApiError(error) && error.status === 404 ? "not_found" : isApiError(error) && error.status === 423 ? "shop_off" : "failed";
  }
  if (answer === "registered") {
    await rememberTillRegistered(tenantId, branchId);
    return "registered";
  }
  if (answer === "failed") {
    return "unknown";
  }
  const seenAt = await readTenantValue("tillSeen", tenantId);
  return interpretTillAnswer(answer, seenAt === branchId);
}

// src/till-access.ts
async function requestTillAccess(api, ask) {
  const branchId = ask.branchId?.trim() ?? "";
  if (!branchId) return false;
  const deviceKey = ask.deviceKey?.trim() || await getOrCreateTillDeviceId(api.tenantId) || "";
  if (!deviceKey) return false;
  try {
    await api.post("/api/v1/till-access-requests", {
      branchId,
      deviceKey,
      ...ask.deviceName?.trim() ? { deviceName: ask.deviceName.trim() } : {}
    });
    return true;
  } catch {
    return false;
  }
}

// src/known-staff.ts
var MAX_KNOWN_STAFF = 6;
var MAX_EMAIL_LENGTH = 191;
var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email2 = value.trim().toLowerCase();
  return email2.length <= MAX_EMAIL_LENGTH && EMAIL_SHAPE.test(email2) ? email2 : null;
}
function firstName(name) {
  return cleanDisplayText(name, 60).split(" ")[0] ?? "";
}
function parseKnownStaff(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const seen = /* @__PURE__ */ new Set();
  const people = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const email2 = normalizeEmail(entry.email);
    if (!email2 || seen.has(email2)) continue;
    seen.add(email2);
    people.push({ email: email2, name: firstName(String(entry.name ?? "")) });
    if (people.length >= MAX_KNOWN_STAFF) break;
  }
  return people;
}
function serializeKnownStaff(people) {
  return JSON.stringify(people.slice(0, MAX_KNOWN_STAFF));
}
function addKnownStaff(people, person) {
  const email2 = normalizeEmail(person.email);
  if (!email2) return people;
  const entry = { email: email2, name: firstName(person.name) };
  return [entry, ...people.filter((other) => other.email !== email2)].slice(0, MAX_KNOWN_STAFF);
}
function removeKnownStaff(people, email2) {
  const target = normalizeEmail(email2);
  return target ? people.filter((person) => person.email !== target) : people;
}
async function loadKnownStaff(tenantId) {
  return parseKnownStaff(await readTenantValue("knownStaff", tenantId));
}
async function rememberStaff(person, tenantId) {
  const next = addKnownStaff(await loadKnownStaff(tenantId), person);
  await writeTenantValue("knownStaff", serializeKnownStaff(next), tenantId);
}
async function forgetKnownStaff(email2, tenantId) {
  const next = removeKnownStaff(await loadKnownStaff(tenantId), email2);
  if (next.length === 0) {
    await removeTenantValue("knownStaff", tenantId);
    return;
  }
  await writeTenantValue("knownStaff", serializeKnownStaff(next), tenantId);
}
async function clearKnownStaff(tenantId) {
  await removeTenantValue("knownStaff", tenantId);
}

// src/pairing.ts
var PREVIEW_PATH = "/api/v1/public/till-pairing/preview";
var PAIR_PATH = "/api/v1/public/till-pairing/pair";
var PAIRING_CODE_MIN_LENGTH = 6;
var PAIRING_CODE_MAX_LENGTH = 12;
function parsePairingCode(input) {
  const code = input.toUpperCase().replace(/[\s._-]/g, "");
  if ([...code].some((character) => !SHOP_CODE_ALPHABET.includes(character))) {
    return { kind: "invalid_characters" };
  }
  if (code.length < PAIRING_CODE_MIN_LENGTH) {
    return { kind: "incomplete" };
  }
  return code.length > PAIRING_CODE_MAX_LENGTH ? { kind: "too_long" } : { kind: "ok", code };
}
var MAX_SCAN_LENGTH2 = 512;
var PAIRING_LINK = /^(?:kiosk:\/\/pair|https:\/\/([^/?#]+)\/pair)\/([^/?#]+)\/?(?:[?#].*)?$/i;
function onPlatformApex2(host) {
  const suffix = tenantHostSuffix().trim().toLowerCase().replace(/^\./, "");
  const bare = host.toLowerCase().replace(/:\d+$/, "");
  return bare === suffix || bare === `www.${suffix}`;
}
function parsePairingScan(text3) {
  if (text3.length > MAX_SCAN_LENGTH2) return null;
  const match = PAIRING_LINK.exec(text3.trim());
  if (!match) return null;
  const host = match[1];
  if (host !== void 0 && !onPlatformApex2(host)) return null;
  let candidate = match[2] ?? "";
  try {
    candidate = decodeURIComponent(candidate);
  } catch {
    return null;
  }
  const parse = parsePairingCode(candidate);
  return parse.kind === "ok" ? parse.code : null;
}
var MAX_ID = 64;
function id2(value) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= MAX_ID ? value.trim() : null;
}
function parsePairingPreview(body) {
  if (!body || typeof body !== "object") return null;
  const record = body;
  const shopRecord = record.shop && typeof record.shop === "object" ? record.shop : null;
  const branchRecord = record.branch && typeof record.branch === "object" ? record.branch : null;
  const roleRecord = record.role && typeof record.role === "object" ? record.role : null;
  const shop = id2(shopRecord?.host) ?? id2(shopRecord?.slug);
  const shopId = id2(shopRecord?.id ?? shopRecord?.businessId);
  const branchId = id2(branchRecord?.id);
  if (!shop || !branchId) return null;
  const shopName = cleanDisplayText(shopRecord?.displayName ?? shopRecord?.name) || shop;
  const tillName = cleanDisplayText(record.tillName, 60);
  return {
    shop,
    ...shopId ? { shopId } : {},
    shopName,
    branchId,
    branchName: cleanDisplayText(branchRecord?.name) || "this branch",
    roleName: cleanDisplayText(roleRecord?.name) || "staff",
    ...tillName ? { tillName } : {}
  };
}
function retryAfter(value) {
  if (!value) return void 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(Math.ceil(seconds), 3600) : void 0;
}
function problemFor(status, retryAfterHeader) {
  if (status === 429) return { kind: "rate_limited", retryAfterSec: retryAfter(retryAfterHeader) };
  if (status === 404) return { kind: "not_found" };
  if (status === 410) return { kind: "expired" };
  if (status === 409) return { kind: "used" };
  if (status < 400 || status >= 500 || status === 408) return { kind: "offline" };
  return { kind: "refused" };
}
async function postJson(url, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    let body = null;
    if (response.ok) {
      try {
        body = await response.json();
      } catch {
      }
    }
    return { kind: "response", status: response.status, body, retryAfter: response.headers?.get?.("retry-after") ?? null };
  } catch {
    return { kind: "offline" };
  } finally {
    clearTimeout(timer);
  }
}
async function previewPairing(code, baseURL, options = {}) {
  const base = baseURL.replace(/\/+$/, "");
  const posted = await postJson(`${base}${PREVIEW_PATH}`, { code }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (posted.kind === "offline") return { kind: "offline" };
  if (posted.status !== 200) return problemFor(posted.status, posted.retryAfter);
  const preview = parsePairingPreview(posted.body);
  return preview ? { kind: "found", preview } : { kind: "offline" };
}
async function redeemPairing(code, deviceKey, baseURL, options = {}) {
  if (!deviceKey.trim()) return { kind: "refused" };
  const base = baseURL.replace(/\/+$/, "");
  const posted = await postJson(`${base}${PAIR_PATH}`, { code, deviceKey }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (posted.kind === "offline") return { kind: "offline" };
  if (posted.status >= 200 && posted.status < 300) return { kind: "paired" };
  return problemFor(posted.status, posted.retryAfter);
}

// src/stock-qty.ts
var QTY_SCALE = 1e4;
var MAX_QTY_UNITS = 1e6 * QTY_SCALE;
var MAX_READ_UNITS = 1e9 * QTY_SCALE;
var QTY_TEXT = /^(\d*)(?:\.(\d*))?$/;
function parseQty(text3, options = {}) {
  const typed = text3.trim();
  if (!typed) return { ok: false, problem: "empty" };
  const match = QTY_TEXT.exec(typed);
  if (!match) return { ok: false, problem: "not_a_number" };
  const whole2 = (match[1] ?? "").replace(/^0+(?=\d)/, "");
  const fraction = match[2] ?? "";
  if (!whole2 && !fraction) return { ok: false, problem: "not_a_number" };
  const significant = fraction.replace(/0+$/, "");
  if (significant.length > 4) return { ok: false, problem: "too_many_decimals" };
  if (whole2.length > 7) return { ok: false, problem: "too_big" };
  const units = Number(whole2 || "0") * QTY_SCALE + Number(significant.padEnd(4, "0"));
  if (units === 0 && options.allowZero !== true) return { ok: false, problem: "zero" };
  if (units > MAX_QTY_UNITS) return { ok: false, problem: "too_big" };
  return { ok: true, units };
}
function qtyProblemWords(problem) {
  switch (problem) {
    case "empty":
      return "Enter a quantity.";
    case "not_a_number":
      return "Use digits and a point, like 2.5.";
    case "too_many_decimals":
      return "Four decimals at most, like 0.125.";
    case "zero":
      return "The quantity must be above zero.";
    case "too_big":
      return "That is over a million. Check the number.";
  }
}
var NUMERIC_TEXT = /^-?\d{1,12}(?:\.\d{1,12})?$/;
function qtyToUnits(value) {
  let n;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string" && NUMERIC_TEXT.test(value.trim())) {
    n = Number(value.trim());
  } else {
    return null;
  }
  if (!Number.isFinite(n)) return null;
  const units = Math.round(n * QTY_SCALE);
  return Math.abs(units) <= MAX_READ_UNITS ? units : null;
}
function unitsToQty(units) {
  return Math.round(units) / QTY_SCALE;
}
function formatQty(units) {
  const rounded = Math.round(units);
  const negative = rounded < 0;
  const absolute = Math.abs(rounded);
  const whole2 = Math.floor(absolute / QTY_SCALE);
  const fraction = absolute % QTY_SCALE;
  const decimals = fraction === 0 ? "" : `.${String(fraction).padStart(4, "0").replace(/0+$/, "")}`;
  const grouped = String(whole2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${decimals}`;
}

// src/stock-items.ts
var MAX_ID_LENGTH2 = 64;
var PRICE_TEXT = /^\d{1,9}(?:\.\d{1,8})?$/;
var MAX_PRICE_CENTS = 1e9;
function priceToCents(value) {
  let text3;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > 9999999) return null;
    text3 = value.toFixed(6);
  } else if (typeof value === "string") {
    text3 = value.trim();
  } else {
    return null;
  }
  if (!PRICE_TEXT.test(text3)) return null;
  const [whole2 = "0", fraction = ""] = text3.split(".");
  const digits = fraction.padEnd(3, "0");
  let cents = Number(whole2) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) cents += 1;
  return cents <= MAX_PRICE_CENTS ? cents : null;
}
function text2(raw, max) {
  const cleaned = cleanDisplayText(raw, max);
  return cleaned ? cleaned : null;
}
function readStockItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw;
  if (row.groupLabelOnly === true) return null;
  const id3 = typeof row.id === "string" ? row.id.trim() : "";
  const name = text2(row.name, 120);
  if (!id3 || id3.length > MAX_ID_LENGTH2 || !name) return null;
  return {
    id: id3,
    name,
    variantName: text2(row.variantName, 80),
    sku: text2(row.sku, 64),
    barcode: text2(row.barcode, 64),
    onHandUnits: row.stockQty === void 0 || row.stockQty === null ? null : qtyToUnits(row.stockQty),
    weighed: row.isWeighed === true,
    unitType: text2(row.unitType, 24),
    packageVariant: row.packageVariant === true,
    itemTypeId: typeof row.itemTypeId === "string" && row.itemTypeId.trim() ? row.itemTypeId.trim() : null,
    active: row.active !== false,
    sellable: row.isSellable !== false,
    buyingCents: priceToCents(row.buyingPrice),
    sellingCents: priceToCents(row.sellingPrice)
  };
}
function itemLabel(item) {
  return item.variantName ? `${item.name} (${item.variantName})` : item.name;
}
function whole(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}
function readItemsPage(raw, asked) {
  if (!raw || typeof raw !== "object") return null;
  const body = raw;
  if (!Array.isArray(body.content)) return null;
  const nested = body.page && typeof body.page === "object" ? body.page : {};
  const total = whole(body.totalElements) ?? whole(nested.totalElements);
  const rows = body.content;
  const items = [];
  for (const row of rows) {
    const item = readStockItem(row);
    if (item) items.push(item);
  }
  let more;
  if (typeof body.last === "boolean") {
    more = !body.last;
  } else if (total !== null) {
    more = (asked.page + 1) * asked.size < total;
  } else {
    more = rows.length >= asked.size && rows.length > 0;
  }
  return { items, seen: rows.length, total, more };
}
var ITEM_PAGE_SIZE = 40;
var MAX_PAGE_SIZE = 100;
var MAX_SEARCH_LENGTH2 = 80;
function searchTerms(typed) {
  const cleaned = cleanDisplayText(typed, MAX_SEARCH_LENGTH2);
  if (!cleaned) return null;
  return /^\d{6,14}$/.test(cleaned) ? { barcode: cleaned } : { search: cleaned };
}
function itemsPath(query) {
  const parts = [`branchId=${encodeURIComponent(query.branchId)}`];
  const search = query.search ? cleanDisplayText(query.search, MAX_SEARCH_LENGTH2) : "";
  if (search) parts.push(`search=${encodeURIComponent(search)}`);
  const barcode = query.barcode ? cleanDisplayText(query.barcode, 64) : "";
  if (barcode) parts.push(`barcode=${encodeURIComponent(barcode)}`);
  if (query.categoryId) parts.push(`categoryId=${encodeURIComponent(query.categoryId)}`);
  if (query.itemTypeId) parts.push(`itemTypeId=${encodeURIComponent(query.itemTypeId)}`);
  if (query.lowStock) parts.push("lowStock=true");
  if (query.zeroStock) parts.push("zeroStock=true");
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.size ?? ITEM_PAGE_SIZE)));
  const page = Math.max(0, Math.floor(query.page ?? 0));
  parts.push(`size=${size}`, `page=${page}`);
  return `/api/v1/items?${parts.join("&")}`;
}
function readCategories(raw) {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray(raw.content) ? raw.content : [];
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry;
    const id3 = typeof row.id === "string" ? row.id.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!id3 || !name || seen.has(id3)) continue;
    seen.add(id3);
    out.push({ id: id3, name: name.slice(0, 60) });
  }
  return out;
}
async function fetchCategories(api) {
  return readCategories(await api.get("/api/v1/categories"));
}
function readDepartments(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry;
    const id3 = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : typeof row.name === "string" ? row.name.trim() : "";
    if (!id3 || !label || row.active === false) continue;
    const color = typeof row.color === "string" && /^#[0-9a-fA-F]{6}$/.test(row.color.trim()) ? row.color.trim() : null;
    const sortOrder = typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder) ? row.sortOrder : 0;
    out.push({ id: id3, label: label.slice(0, 60), color, sortOrder });
  }
  return out.sort((a, b) => a.sortOrder - b.sortOrder);
}
async function fetchDepartments(api) {
  return readDepartments(await api.get("/api/v1/item-types"));
}

// src/stock-adjust.ts
var NOTE_MAX = 200;
function cleanNote(text3, fallback) {
  const typed = (text3 ?? "").replace(/\s+/g, " ").trim();
  return Array.from(typed || fallback).slice(0, NOTE_MAX).join("");
}
function planSetOnHand(input) {
  if (input.packageVariant) return { ok: false, problem: "pack_variant" };
  if (input.currentUnits === null || !Number.isFinite(input.currentUnits)) return { ok: false, problem: "current_unknown" };
  const delta = input.targetUnits - input.currentUnits;
  if (delta === 0) return { ok: true, plan: { kind: "same" } };
  const trail = `Set from phone: ${formatQty(input.currentUnits)} to ${formatQty(input.targetUnits)}`;
  const note = cleanNote(input.note, trail);
  if (delta > 0) {
    return { ok: true, plan: { kind: "increase", units: delta, unitCostCents: input.buyingCents ?? 0, note } };
  }
  return { ok: true, plan: { kind: "decrease", units: -delta, note } };
}
function stockIncreaseBody(branchId, itemId2, plan) {
  return { branchId, itemId: itemId2, quantity: unitsToQty(plan.units), unitCost: plan.unitCostCents / 100, notes: plan.note };
}
function allocationPreviewPath(itemId2, branchId, units) {
  return `/api/v1/inventory/allocation-preview?itemId=${encodeURIComponent(itemId2)}&branchId=${encodeURIComponent(branchId)}&quantity=${unitsToQty(units)}`;
}
function planDecreaseCalls(preview, wantedUnits) {
  const calls = [];
  let covered = 0;
  if (Array.isArray(preview)) {
    for (const line of preview) {
      if (covered >= wantedUnits) break;
      if (!line || typeof line !== "object") continue;
      const row = line;
      const batchId = typeof row.batchId === "string" ? row.batchId.trim() : "";
      const units = qtyToUnits(row.quantity);
      if (!batchId || batchId.length > 64 || units === null || units <= 0) continue;
      const take = Math.min(units, wantedUnits - covered);
      calls.push({ batchId, units: take });
      covered += take;
    }
  }
  if (calls.length === 0) return { ok: false, problem: "none", coveredUnits: 0 };
  if (covered < wantedUnits) return { ok: false, problem: "short", coveredUnits: covered };
  return { ok: true, calls };
}
function batchDecreaseBody(call, note) {
  return { batchId: call.batchId, quantity: unitsToQty(call.units), reason: note };
}
var SPOIL_REASONS = [
  { key: "SPOILAGE", label: "Spoiled" },
  { key: "EXPIRED", label: "Expired" },
  { key: "BREAKAGE", label: "Broken or damaged" },
  { key: "THEFT", label: "Stolen" },
  { key: "SAMPLE", label: "Sample or tasting" },
  { key: "PERSONAL_USE", label: "Own use" },
  { key: "OTHER", label: "Something else" }
];
function isSpoilReason(value) {
  return SPOIL_REASONS.some((reason) => reason.key === value);
}
function spoilUnitCostCents(item) {
  if (item.buyingCents !== null && item.buyingCents > 0) return item.buyingCents;
  if (item.sellingCents !== null && item.sellingCents > 0) return item.sellingCents;
  return 1;
}
function wastageBody(input) {
  return {
    branchId: input.branchId,
    itemId: input.itemId,
    quantity: unitsToQty(input.units),
    unitCost: Math.max(1, input.unitCostCents) / 100,
    reason: cleanNote(input.note, "Written off on the phone"),
    wastageReason: input.reason
  };
}
function readHistory(raw) {
  if (!raw || typeof raw !== "object") return null;
  const entries = raw.entries;
  if (!Array.isArray(entries)) return null;
  const out = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry;
    const delta = qtyToUnits(row.quantityDelta);
    const operationId = typeof row.referenceId === "string" ? row.referenceId.trim() : "";
    if (typeof row.eventType !== "string" || delta === null || !operationId) continue;
    const at = typeof row.createdAt === "string" ? Date.parse(row.createdAt) : NaN;
    out.push({
      eventType: row.eventType,
      branchId: typeof row.branchId === "string" ? row.branchId : null,
      deltaUnits: delta,
      operationId,
      at: Number.isFinite(at) ? at : null
    });
  }
  return out;
}
var HISTORY_SLACK_MS = 10 * 6e4;
function readItemHistory(raw, limit) {
  const entries = readHistory(raw);
  if (!entries) return null;
  const rows = raw.entries;
  let oldestAt = null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const created = row.createdAt;
    const at = typeof created === "string" ? Date.parse(created) : Number.NaN;
    if (Number.isFinite(at) && (oldestAt === null || at < oldestAt)) oldestAt = at;
  }
  return { entries, full: rows.length >= limit, oldestAt };
}
function spoilOperations(history, branchId) {
  const found = /* @__PURE__ */ new Map();
  for (const entry of history) {
    if (entry.eventType !== "stock.wastage" || entry.branchId !== branchId || entry.deltaUnits >= 0) continue;
    const seen = found.get(entry.operationId);
    const at = entry.at === null ? seen?.at ?? null : seen?.at === void 0 || seen.at === null ? entry.at : Math.min(seen.at, entry.at);
    found.set(entry.operationId, { units: (seen?.units ?? 0) - entry.deltaUnits, at });
  }
  return found;
}
function findNewSpoil(history, input) {
  const slack = input.slackMs ?? HISTORY_SLACK_MS;
  for (const [operationId, op] of spoilOperations(history, input.branchId)) {
    if (input.known.has(operationId) || op.units !== input.units) continue;
    if (input.since !== void 0 && op.at !== null && op.at < input.since - slack) continue;
    return { operationId };
  }
  return null;
}
function classifyWrite(error) {
  if (!isApiError(error) || error.foreign) return { kind: "doubt" };
  const { status } = error;
  if (status === 401 || status === 408 || status === 423 || status === 429 || status >= 500) return { kind: "doubt" };
  if (status >= 400) return { kind: "refused", words: cleanDisplayText(error.hint || error.message, 140) || "The server did not accept that." };
  return { kind: "doubt" };
}

// src/stock-access.ts
var DEFAULT_STOCK_SETTINGS = { spoils: true, stockEdit: true, orderPad: true };
function parseStockSettings(body) {
  if (!body || typeof body !== "object") return DEFAULT_STOCK_SETTINGS;
  const inventory = body.inventory;
  const levels = inventory && typeof inventory === "object" ? inventory.stockLevels : null;
  if (!levels || typeof levels !== "object") return DEFAULT_STOCK_SETTINGS;
  const switches = levels;
  return {
    spoils: switches.allowSpoilsForGroceryClerk !== false,
    stockEdit: switches.allowStockEditForGroceryClerk !== false,
    orderPad: switches.allowOrderPadForGroceryClerk !== false
  };
}
var INVENTORY_WRITE = "inventory.write";
var STOCK_TAKE_RUN = "stocktake.run";
var STOCK_TAKE_APPROVE = "stocktake.approve";
var INVENTORY_TRANSFER = "inventory.transfer";
var CATALOG_ITEMS_READ = "catalog.items.read";
var INVENTORY_READ = "inventory.read";
var GROCERY_INVOICES_CREATE = "grocery.invoices.create";
var GROCERY_INVOICES_PAY = "grocery.invoices.pay";
var GROCERY_INVOICES_CANCEL = "grocery.invoices.cancel";
var PURCHASING_PATH_A_WRITE = "purchasing.path_a.write";
function has(user, permission) {
  return user.permissions.includes(permission);
}
function isGroceryCounterRole(roleKey) {
  const key = (roleKey ?? "").trim().toLowerCase();
  return key === "grocery_clerk" || key === "grocery_manager";
}
function maySellAtCounter(user) {
  return has(user, GROCERY_INVOICES_CREATE) || isGroceryCounterRole(user.roleKey);
}
function mayOrderAtCounter(user, settings) {
  if (!settings.orderPad) return false;
  return has(user, PURCHASING_PATH_A_WRITE) || isGroceryCounterRole(user.roleKey);
}
function counterModes(user, settings) {
  const modes = [];
  if (maySellAtCounter(user)) modes.push("sell");
  const mayWrite = has(user, INVENTORY_WRITE) || isGroceryCounterRole(user.roleKey);
  if (mayWrite && settings.spoils) modes.push("spoils");
  if (mayWrite && settings.stockEdit) modes.push("stockEdit");
  return modes;
}
function stockAppMayWrite(user) {
  return has(user, INVENTORY_WRITE) || (user.roleKey ?? "").trim().toLowerCase() === "stock_manager";
}
function mayCountStock(user) {
  return has(user, STOCK_TAKE_RUN);
}
function mayCloseStockTake(user) {
  return has(user, STOCK_TAKE_APPROVE);
}
function mayMoveStock(user) {
  return has(user, INVENTORY_TRANSFER);
}

// src/departments.ts
function visibleDepartments(all, user) {
  const assigned = assignedItemTypeIds(user);
  if (assigned.length > 0) {
    const allowed = new Set(assigned);
    return all.filter((d) => allowed.has(d.id));
  }
  const role = (user.roleKey ?? "").trim().toLowerCase();
  if (role === "grocery_clerk") return [];
  return [...all];
}
function supplierItemTypeScope(user) {
  const assigned = assignedItemTypeIds(user);
  if (assigned.length > 0) return assigned;
  const role = (user.roleKey ?? "").trim().toLowerCase();
  if (role === "grocery_clerk") return [];
  return void 0;
}
function assignedItemTypeIds(user) {
  return [
    ...new Set(
      user.itemTypeIds.map((id3) => id3.trim()).filter((id3) => id3.length > 0)
    )
  ];
}

// src/keeper.ts
function createKeeper(options) {
  const { initial, parse, serialize, storage } = options;
  let state = initial;
  let loaded = false;
  let loading = null;
  let queued = null;
  let running = null;
  let lastLanded = true;
  const listeners2 = /* @__PURE__ */ new Set();
  function notify() {
    for (const listener of [...listeners2]) {
      try {
        listener();
      } catch {
      }
    }
  }
  async function drain() {
    try {
      while (queued) {
        const next = queued;
        queued = null;
        try {
          lastLanded = await storage.write(next.text);
        } catch {
          lastLanded = false;
        }
      }
    } finally {
      running = null;
    }
    return lastLanded;
  }
  return {
    load(now) {
      if (loaded) return Promise.resolve(state);
      loading ??= storage.read().then(
        (text3) => {
          loading = null;
          state = parse(text3, now);
          loaded = true;
          notify();
          return state;
        },
        (error) => {
          loading = null;
          throw error;
        }
      );
      return loading;
    },
    get: () => state,
    isLoaded: () => loaded,
    update(change) {
      if (!loaded) throw new Error("What is kept on this phone has not been read yet.");
      const next = change(state);
      if (next === state) return state;
      const text3 = serialize(next);
      state = next;
      queued = { text: text3 };
      running ??= drain();
      notify();
      return state;
    },
    subscribe(listener) {
      listeners2.add(listener);
      return () => {
        listeners2.delete(listener);
      };
    },
    saved: () => running ?? Promise.resolve(lastLanded)
  };
}

// src/spoils.ts
var MAX_SPOIL_LINES = 100;
var SPOIL_LIST_LIFETIME_MS = 12 * 60 * 6e4;
var MAX_BASELINE = 200;
function emptySpoils(owner, now) {
  return { ownerId: owner.ownerId, branchId: owner.branchId, savedAt: now, reason: "SPOILAGE", lines: [], inFlight: null };
}
function claimSpoils(list, owner, now) {
  if (!list) return emptySpoils(owner, now);
  if (list.ownerId === owner.ownerId && list.branchId === owner.branchId) return list;
  return { ...emptySpoils(owner, now), inFlight: list.inFlight };
}
function touch(list, now, change) {
  return { ...list, ...change, savedAt: now };
}
function addSpoil(list, item, units, now) {
  if (!Number.isInteger(units) || units <= 0) return { ok: false, why: "bad_quantity" };
  if (list.inFlight && list.inFlight.itemId === item.id) return { ok: false, why: "busy" };
  const existing = list.lines.find((line) => line.itemId === item.id);
  if (!existing && list.lines.length >= MAX_SPOIL_LINES) return { ok: false, why: "too_many" };
  if ((existing ? existing.units : 0) + units > MAX_QTY_UNITS) return { ok: false, why: "too_big" };
  const lines = existing ? list.lines.map((line) => line.itemId === item.id ? { ...line, units: line.units + units } : line) : [...list.lines, { itemId: item.id, name: item.name, units, unitCostCents: spoilUnitCostCents(item), weighed: item.weighed }];
  return { ok: true, list: touch(list, now, { lines }) };
}
function setSpoilUnits(list, itemId2, units, now) {
  if (!Number.isInteger(units) || units <= 0 || units > MAX_QTY_UNITS || list.inFlight?.itemId === itemId2) return list;
  return touch(list, now, { lines: list.lines.map((line) => line.itemId === itemId2 ? { ...line, units } : line) });
}
function removeSpoil(list, itemId2, now) {
  if (list.inFlight?.itemId === itemId2 || !list.lines.some((line) => line.itemId === itemId2)) return list;
  return touch(list, now, { lines: list.lines.filter((line) => line.itemId !== itemId2) });
}
function setReason(list, reason, now) {
  return reason === list.reason ? list : touch(list, now, { reason });
}
function clearSpoils(list, now) {
  return list.inFlight || list.lines.length === 0 ? list : touch(list, now, { lines: [] });
}
function nextSpoil(list) {
  return list.inFlight ? null : list.lines[0] ?? null;
}
function beginSpoil(list, line, baseline, now) {
  if (list.inFlight) return null;
  if (!list.lines.some((candidate) => candidate.itemId === line.itemId && candidate.units === line.units)) return null;
  return touch(list, now, {
    inFlight: {
      itemId: line.itemId,
      name: line.name,
      units: line.units,
      unitCostCents: line.unitCostCents,
      reason: list.reason,
      branchId: list.branchId,
      baseline: baseline.slice(-MAX_BASELINE),
      startedAt: now
    }
  });
}
function beginSending(keeper, line, baseline, now) {
  if (!keeper.isLoaded()) return false;
  let began = false;
  keeper.update((latest) => {
    const next = latest ? beginSpoil(latest, line, baseline, now) : null;
    if (!next) return latest;
    began = true;
    return next;
  });
  return began;
}
function spoilDone(list, now) {
  const flight = list.inFlight;
  if (!flight) return list;
  const lines = list.lines.filter((line) => !(line.itemId === flight.itemId && line.units === flight.units));
  return touch(list, now, { lines, inFlight: null });
}
function spoilNotDone(list, now) {
  return list.inFlight ? touch(list, now, { inFlight: null }) : list;
}
function spoilSkipped(list, now) {
  return spoilDone(list, now);
}
var SPOIL_SETTLE_MS = 2 * 6e4;
function spoilVerdict(history, flight, now) {
  if (!history) return "unknown";
  const found = findNewSpoil(history.entries, { branchId: flight.branchId, units: flight.units, known: new Set(flight.baseline), since: flight.startedAt });
  if (found) return "done";
  if (now - flight.startedAt < SPOIL_SETTLE_MS) return "too_soon";
  if (history.full && (history.oldestAt === null || history.oldestAt > flight.startedAt - HISTORY_SLACK_MS)) return "too_busy";
  return "not_seen";
}
function encodeSpoils(list) {
  if (!list || list.lines.length === 0 && !list.inFlight) return null;
  return JSON.stringify({ v: 1, ...list });
}
function isText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}
function isUnits(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 1e10;
}
function isCents(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1e9;
}
function decodeSpoils(text3, now) {
  if (!text3) return null;
  let raw;
  try {
    raw = JSON.parse(text3);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const body = raw;
  if (body.v !== 1 || !isText(body.ownerId) || !isText(body.branchId) || typeof body.savedAt !== "number" || !isSpoilReason(body.reason) || !Array.isArray(body.lines)) return null;
  const lines = [];
  for (const row of body.lines) {
    if (!row || typeof row !== "object") return null;
    const line = row;
    if (!isText(line.itemId) || typeof line.name !== "string" || !isUnits(line.units) || !isCents(line.unitCostCents) || typeof line.weighed !== "boolean") return null;
    lines.push({ itemId: line.itemId, name: line.name, units: line.units, unitCostCents: line.unitCostCents, weighed: line.weighed });
  }
  let inFlight = null;
  if (body.inFlight !== null && body.inFlight !== void 0) {
    const f = body.inFlight;
    if (!f || typeof f !== "object" || !isText(f.itemId) || typeof f.name !== "string" || !isUnits(f.units) || !isCents(f.unitCostCents) || !isSpoilReason(f.reason) || typeof f.startedAt !== "number") return null;
    if (!Array.isArray(f.baseline) || !f.baseline.every((id3) => typeof id3 === "string")) return null;
    const flightBranch = f.branchId === void 0 ? body.branchId : f.branchId;
    if (!isText(flightBranch)) return null;
    inFlight = { itemId: f.itemId, name: f.name, units: f.units, unitCostCents: f.unitCostCents, reason: f.reason, branchId: flightBranch, baseline: f.baseline, startedAt: f.startedAt };
  }
  if (!inFlight && now - body.savedAt > SPOIL_LIST_LIFETIME_MS) return null;
  return { ownerId: body.ownerId, branchId: body.branchId, savedAt: body.savedAt, reason: body.reason, lines, inFlight };
}

// src/tenant-keeper.ts
var keepers = /* @__PURE__ */ new Map();
function keyOf(tenantId, field) {
  return `${tenantId}\0${field}`;
}
function tenantKeeper(field, tenantId, codec) {
  const key = keyOf(tenantId, field);
  const existing = keepers.get(key);
  if (existing) return existing;
  const keeper = createKeeper({
    initial: codec.initial,
    parse: codec.parse,
    serialize: codec.serialize,
    storage: {
      read: () => readTenantValue(field, tenantId),
      write: async (value) => {
        if (value === null) {
          await removeTenantValue(field, tenantId);
          return true;
        }
        return writeTenantValue(field, value, tenantId);
      }
    }
  });
  keepers.set(key, keeper);
  return keeper;
}
function dropTenantKeepers(tenantId) {
  const prefix = `${tenantId}\0`;
  for (const key of [...keepers.keys()]) {
    if (key.startsWith(prefix)) keepers.delete(key);
  }
}

// src/timeout.ts
var TimeoutError = class extends Error {
  ms;
  constructor(ms) {
    super(`No answer after ${Math.round(ms / 1e3)} seconds`);
    this.name = "TimeoutError";
    this.ms = ms;
  }
};
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
var READ_TIMEOUT_MS = 2e4;
var WRITE_TIMEOUT_MS = 6e4;

// src/words.ts
function formatCents(cents) {
  if (!Number.isFinite(cents)) return "\u2014";
  const rounded = Math.round(cents);
  const negative = rounded < 0;
  const whole2 = Math.floor(Math.abs(rounded) / 100);
  const fraction = Math.abs(rounded) % 100;
  const grouped = String(whole2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${String(fraction).padStart(2, "0")}`;
}
function formatKes(cents) {
  return `KES ${formatCents(cents)}`;
}
function readFailureWords(error) {
  if (isApiError(error)) {
    if (error.foreign) return "The connection is not reaching the shop. A sign-in page for the wifi may be in the way.";
    if (error.status === 401) return "You were signed out. Sign in again.";
    if (error.status === 403) return "Your role is not allowed to see this.";
    if (error.status === 404) return "That is no longer there.";
    if (error.status >= 500) return "The server had a problem. Try again in a minute.";
  }
  return "Could not reach the server. Check the signal and try again.";
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  APP_ENTRY_PERMISSIONS,
  APP_JOBS,
  APP_NAMES,
  ApiError,
  BRANCH_LOCKED_ROLE_KEYS,
  CATALOG_ITEMS_READ,
  DEFAULT_PLATFORM_CONFIG,
  DEFAULT_PLATFORM_HOST_SUFFIX,
  DEFAULT_STOCK_SETTINGS,
  GROCERY_INVOICES_CANCEL,
  GROCERY_INVOICES_CREATE,
  GROCERY_INVOICES_PAY,
  HISTORY_SLACK_MS,
  INVENTORY_READ,
  INVENTORY_TRANSFER,
  INVENTORY_WRITE,
  ITEM_PAGE_SIZE,
  MAX_BASELINE,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_KNOWN_STAFF,
  MAX_QTY_UNITS,
  MAX_SPOIL_LINES,
  MIN_SEARCH_LENGTH,
  NATIVE_KIOSK_CLIENT_HEADER,
  NATIVE_KIOSK_CLIENT_VALUE,
  PAIRING_CODE_MAX_LENGTH,
  PAIRING_CODE_MIN_LENGTH,
  PURCHASING_PATH_A_WRITE,
  QTY_SCALE,
  READ_TIMEOUT_MS,
  SHOP_CODE_ALPHABET,
  SHOP_CODE_MAX_LENGTH,
  SHOP_CODE_MIN_LENGTH,
  SPOIL_LIST_LIFETIME_MS,
  SPOIL_REASONS,
  SPOIL_SETTLE_MS,
  STAFF_APPS,
  STOCK_TAKE_APPROVE,
  STOCK_TAKE_RUN,
  StoreLookupError,
  StoreSwitchBlockedError,
  TILL_DEVICE_HEADER,
  TimeoutError,
  UNOWNED_ID,
  WRITE_TIMEOUT_MS,
  activateStore,
  addKnownStaff,
  addSpoil,
  allocationPreviewPath,
  apiRequest,
  appsThatFit,
  asSetupRequired,
  batchDecreaseBody,
  beginSending,
  beginSpoil,
  bootstrapStore,
  bootstrapTenant,
  checkTillRegistration,
  claimSpoils,
  classifyStore,
  classifyWrite,
  cleanDisplayText,
  cleanSearchText,
  clearActiveStore,
  clearKnownStaff,
  clearSpoils,
  clearTenant,
  clearTokens,
  compareVersions,
  counterModes,
  createApiClient,
  createKeeper,
  decodeSpoils,
  describeFailure,
  describeSetup,
  describeShopCodeProblem,
  describeStoreResult,
  dropTenantKeepers,
  emptySpoils,
  encodeSpoils,
  endSession,
  ensureStorageReady,
  fetchBranches,
  fetchCategories,
  fetchDepartments,
  fetchMe,
  fetchPlatformConfig,
  fetchPublicMobileConfig,
  fetchShiftsDisabled,
  findNewSpoil,
  firstName,
  fitsApp,
  forgetKnownStaff,
  forgetStore,
  forgetTillRegistered,
  formatApiProblemMessage,
  formatCents,
  formatKes,
  formatQty,
  generateIdempotencyKey,
  getAccessToken,
  getActiveTenantId,
  getAppVersion,
  getEmbeddedTenantSlug,
  getOrCreateTillDeviceId,
  getRefreshToken,
  getTenantDisplayName,
  getTenantHeaders,
  getUnsentSummary,
  getWhiteLabelExtra,
  interpretTillAnswer,
  isApiError,
  isBranchLockedRole,
  isProvisionalId,
  isShopperDeepLinkIntent,
  isSpoilReason,
  isStaffDeepLinkIntent,
  isWhiteLabelApp,
  itemLabel,
  itemsPath,
  listRememberedStores,
  loadActiveStore,
  loadKnownStaff,
  loadStoreById,
  loadTenant,
  loginWithPassword,
  loginWithPin,
  logout,
  markSessionEnded,
  mayCloseStockTake,
  mayCountStock,
  mayMoveStock,
  mayOrderAtCounter,
  maySellAtCounter,
  nextSpoil,
  openRememberedStore,
  openStore,
  outboxKey,
  parseKnownStaff,
  parseMe,
  parsePairingCode,
  parsePairingPreview,
  parsePairingScan,
  parsePlatformConfig,
  parseProblem,
  parseQty,
  parseScan,
  parseShopCode,
  parseShopCodeLink,
  parseSignedInUser,
  parseStockSettings,
  parseStoreInput,
  parseTenantDeepLink,
  parseVersion,
  pinLoginBranchId,
  pinnedTo,
  plainHost,
  planDecreaseCalls,
  planSetOnHand,
  previewDeepLink,
  previewPairing,
  previewStore,
  previewStoreByCode,
  priceToCents,
  provisionalId,
  publicApiRequest,
  qtyProblemWords,
  qtyToUnits,
  readApiError,
  readApiErrorMessage,
  readAuthTokens,
  readCategories,
  readCookieFromSetCookie,
  readDepartments,
  readFailureWords,
  readHistory,
  readItemHistory,
  readItemsPage,
  readSetCookieLines,
  readShiftsDisabled,
  readStockItem,
  readTenantSecret,
  readTenantValue,
  redeemPairing,
  refreshAccessToken,
  registerAccount,
  registerUnsentProbe,
  rememberStaff,
  rememberTillRegistered,
  removeKnownStaff,
  removeSpoil,
  removeTenantSecret,
  removeTenantValue,
  requestTillAccess,
  resendVerificationEmail,
  resolveIdempotencyKey,
  resolveMobileApiBaseUrl,
  resolveShopperStore,
  resolveTenant,
  resolveTenantByEmail,
  resolveTenantFromDeepLink,
  revalidateActive,
  searchStores,
  searchTerms,
  serializeKnownStaff,
  sessionWasEnded,
  setReason,
  setSpoilUnits,
  shiftsAreDisabled,
  spoilDone,
  spoilNotDone,
  spoilOperations,
  spoilSkipped,
  spoilUnitCostCents,
  spoilVerdict,
  stockAppMayWrite,
  stockIncreaseBody,
  storeTokens,
  subscribeActiveStore,
  subscribeActiveStoreId,
  supplierItemTypeScope,
  switchStore,
  tenantHost,
  tenantHostSuffix,
  tenantKeeper,
  unitsToQty,
  unreadableOutboxKey,
  unwrapOpened,
  updateStateFor,
  useTenantDeepLink,
  visibleDepartments,
  wastageBody,
  webHomeForRole,
  withOutboxLock,
  withTimeout,
  writeTenantSecret,
  writeTenantValue
});
