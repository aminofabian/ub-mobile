// Module resolution hooks for the tests:
//  - native modules (expo-secure-store, async-storage, expo-constants, react-native) become fakes
//  - @kiosk/core and @kiosk/offline resolve to their sources, not to a stale dist
//  - extensionless relative imports in .ts files resolve (the sources are written for a bundler)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '../../../..');

const FAKES = {
  'expo-secure-store': 'fakes/expo-secure-store.mjs',
  '@react-native-async-storage/async-storage': 'fakes/async-storage.mjs',
  'expo-constants': 'fakes/expo-constants.mjs',
  'react-native': 'fakes/react-native.mjs',
};

const WORKSPACE = {
  '@kiosk/core': 'packages/core/src/index.ts',
  '@kiosk/offline': 'packages/offline/src/index.ts',
};

const SUFFIXES = ['.ts', '/index.ts'];

export async function resolve(specifier, context, nextResolve) {
  const fake = FAKES[specifier];
  if (fake) {
    return { url: pathToFileURL(path.join(here, fake)).href, shortCircuit: true };
  }
  const workspace = WORKSPACE[specifier];
  if (workspace) {
    return { url: pathToFileURL(path.join(mobileRoot, workspace)).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    const parent = context.parentURL ?? '';
    if (relative && /\.(ts|mjs)$/.test(parent)) {
      const base = fileURLToPath(new URL(specifier, parent));
      for (const suffix of SUFFIXES) {
        if (fs.existsSync(base + suffix)) {
          return { url: pathToFileURL(base + suffix).href, shortCircuit: true };
        }
      }
    }
    throw error;
  }
}
