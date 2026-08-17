import { getLocalSchemaVersion, setLocalSchemaVersion } from './cache';

export interface MobileSchemaVersion {
  schemaVersion: number;
  minAppVersion: string;
  breakingChangeAt?: string;
}

export async function checkMobileSchemaVersion(baseURL: string): Promise<MobileSchemaVersion | null> {
  const response = await fetch(`${baseURL}/api/v1/platform/mobile-schema-version`);
  if (!response.ok) return null;

  const remote = (await response.json()) as MobileSchemaVersion;
  const local = await getLocalSchemaVersion();

  if (remote.schemaVersion > local) {
    await setLocalSchemaVersion(remote.schemaVersion);
  }

  return remote;
}
