import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const versionData = JSON.parse(readFileSync(join(root, 'src-tauri', 'version.json'), 'utf8'));
const { version, versionDateTag } = versionData;

if (!version) {
  console.error('version.json must contain a "version" field.');
  process.exit(1);
}

let pkg = readFileSync(join(root, 'package.json'), 'utf8');
pkg = pkg.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}"`);
if (versionDateTag) {
  if (pkg.includes('"versionDateTag"')) {
    pkg = pkg.replace(/"versionDateTag"\s*:\s*"[^"]*"/, `"versionDateTag": "${versionDateTag}"`);
  } else {
    pkg = pkg.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}",\n  "versionDateTag": "${versionDateTag}"`);
  }
} else {
  pkg = pkg.replace(/,?\s*\n\s*"versionDateTag"\s*:\s*"[^"]*"/, '');
}
writeFileSync(join(root, 'package.json'), pkg);

let tauri = readFileSync(join(root, 'src-tauri', 'tauri.conf.json'), 'utf8');
tauri = tauri.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${version}"`);
writeFileSync(join(root, 'src-tauri', 'tauri.conf.json'), tauri);

let cargo = readFileSync(join(root, 'src-tauri', 'Cargo.toml'), 'utf8');
cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
writeFileSync(join(root, 'src-tauri', 'Cargo.toml'), cargo);

console.log(`Synced version ${version}${versionDateTag ? ` (${versionDateTag})` : ''}`);
