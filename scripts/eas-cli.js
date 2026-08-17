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

module.exports = { mobileRoot, easBin };
