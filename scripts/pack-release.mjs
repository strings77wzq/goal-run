#!/usr/bin/env node
import {
  DEFAULT_PACK_DIR,
  assertTarballIsPublishScoped,
  cleanPackDir,
  expectedTarballPath,
  getPublishablePackages,
  listTarballEntries,
  run,
} from './release-utils.mjs';

const root = process.cwd();
const packDir = process.env.GOALRUN_PACK_DIR || DEFAULT_PACK_DIR;
const fullPackDir = cleanPackDir(root, packDir);
const packages = getPublishablePackages(root);

if (packages.length === 0) {
  console.error('No publishable packages found under packages/.');
  process.exit(1);
}

for (const pkg of packages) {
  run('pnpm', ['--dir', pkg.dir, 'pack', '--pack-destination', fullPackDir], {
    cwd: root,
    stdio: 'inherit',
    timeout: 120000,
  });

  const tarballPath = expectedTarballPath(root, packDir, pkg);
  const entries = listTarballEntries(tarballPath);
  assertTarballIsPublishScoped(entries);
  console.log(`Packed ${pkg.name}@${pkg.version}: ${tarballPath}`);
}
