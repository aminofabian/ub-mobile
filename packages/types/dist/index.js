"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  phase_1: () => phase_1_exports,
  phase_15_storefront_public: () => phase_15_storefront_public_exports
});
module.exports = __toCommonJS(index_exports);

// src/generated/phase-1.ts
var phase_1_exports = {};

// src/generated/phase-15-storefront-public.ts
var phase_15_storefront_public_exports = {};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  phase_1,
  phase_15_storefront_public
});
