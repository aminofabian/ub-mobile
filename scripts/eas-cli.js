const fs = require('fs');
const path = require('path');

function mobileRoot() {
  return path.join(__dirname, '..');
}

function easBin() {
  const local = path.join(mobileRoot(), 'node_modules', '.bin', 'eas');
  if (fs.existsSync(local)) {
    return local;
  }
  return 'eas';
}

/** Limit the EAS upload to the Expo workspace, not backend/frontend/desktop. */
function easEnv(extra = {}) {
  return {
    ...process.env,
    EAS_NO_VCS: '1',
    EAS_PROJECT_ROOT: mobileRoot(),
    ...extra,
  };
}

module.exports = { mobileRoot, easBin, easEnv };
