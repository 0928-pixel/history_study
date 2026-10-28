const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public');
fs.mkdirSync(out, { recursive: true });
// Explicit allowlist: never publish server code, docs, tests or environment files.
for (const name of fs.readdirSync(root)) {
  if (['index.html', 'feedback-thanks.html'].includes(name) || name === 'site-community.js' || name === 'site-community.css' || /\.(jpg|jpeg|png|webp|gif|ico)$/.test(name) || name === 'images') {
    fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
  }
}
