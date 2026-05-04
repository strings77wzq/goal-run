/**
 * Check that all packages in the monorepo have consistent versions.
 * Exits 0 on success, 1 on mismatch.
 *
 * Usage: node --import tsx scripts/check-versions.ts
 *   or: npx tsx scripts/check-versions.ts
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname ?? '', '..');

interface PkgJson {
  name: string;
  version: string;
}

function readPkg(dir: string): PkgJson {
  const raw = readFileSync(resolve(ROOT, dir, 'package.json'), 'utf-8');
  return JSON.parse(raw) as PkgJson;
}

const packages = [
  '',
  'packages/core',
  'packages/security',
  'packages/harness',
  'packages/reporter',
  'packages/cli',
];

const versions = new Map<string, string[]>();

for (const pkg of packages) {
  const pkgDir = pkg || '.';
  const { name, version } = readPkg(pkgDir);
  const existing = versions.get(version) ?? [];
  existing.push(name);
  versions.set(version, existing);
}

if (versions.size === 1) {
  const [version] = versions.keys();
  console.log(`✅ All ${packages.length} packages at version ${version}`);
  process.exit(0);
} else {
  console.error('❌ Version mismatch detected:');
  for (const [version, names] of versions) {
    console.error(`  ${version}: ${names.join(', ')}`);
  }
  process.exit(1);
}
