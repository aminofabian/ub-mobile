#!/usr/bin/env node
/**
 * CI helper: writes tenant profile JSON from repository_dispatch payload or manual inputs.
 * Prints GITHUB_OUTPUT lines: slug, app, platform, profile_file
 */
const fs = require('fs');

const profileFile = process.env.PROFILE_FILE;
const dispatchPayload = process.env.DISPATCH_PAYLOAD;
const manualSlug = process.env.MANUAL_SLUG?.trim();
const manualApp = process.env.MANUAL_APP?.trim() || 'shopper';
const manualPlatform = process.env.MANUAL_PLATFORM?.trim() || 'all';
const manualProfileJson = process.env.MANUAL_PROFILE_JSON?.trim();
const eventName = process.env.GITHUB_EVENT_NAME;

if (!profileFile) {
  console.error('PROFILE_FILE is required');
  process.exit(1);
}

let slug;
let app = manualApp;
let platform = manualPlatform;
let profile;

if (eventName === 'repository_dispatch' && dispatchPayload && dispatchPayload !== 'null') {
  const payload = JSON.parse(dispatchPayload);
  if (!payload.tenantProfile) {
    console.error('client_payload.tenantProfile is required');
    process.exit(1);
  }
  profile = payload.tenantProfile;
  slug = payload.slug || profile.slug;
  app = payload.app || 'shopper';
  platform = payload.platform || 'all';
} else if (manualProfileJson) {
  profile = JSON.parse(manualProfileJson);
  slug = profile.slug;
} else if (manualSlug) {
  const existingFolder = `mobile/tenants/${manualSlug}/config.json`;
  const existingFlat = `mobile/tenants/${manualSlug}.json`;
  const existing = fs.existsSync(existingFolder)
    ? existingFolder
    : fs.existsSync(existingFlat)
      ? existingFlat
      : null;
  if (!existing) {
    console.error(`Missing ${existingFolder} and no profile_json provided`);
    process.exit(1);
  }
  profile = JSON.parse(fs.readFileSync(existing, 'utf8'));
  slug = manualSlug;
} else {
  console.error('No tenant profile source');
  process.exit(1);
}

if (!slug) {
  console.error('Could not resolve tenant slug');
  process.exit(1);
}

fs.writeFileSync(profileFile, `${JSON.stringify(profile, null, 2)}\n`);

const output = process.env.GITHUB_OUTPUT;
if (output) {
  fs.appendFileSync(
    output,
    `slug=${slug}\napp=${app}\nplatform=${platform}\nprofile_file=${profileFile}\n`
  );
} else {
  console.log(JSON.stringify({ slug, app, platform, profile_file: profileFile }));
}
