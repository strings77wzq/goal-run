#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  DEFAULT_PACK_DIR,
  createInstallSmokePlan,
  expectedTarballPath,
  getPublishablePackages,
  run,
} from './release-utils.mjs';

const root = process.cwd();
const packDir = process.env.GOALRUN_PACK_DIR || DEFAULT_PACK_DIR;
const packages = getPublishablePackages(root);
const plan = createInstallSmokePlan(root, packDir);
const tarballs = packages.map((pkg) => expectedTarballPath(root, packDir, pkg));
const tempDir = mkdtempSync(resolve(tmpdir(), 'goalrun-install-smoke-'));

try {
  writeFileSync(
    resolve(tempDir, 'package.json'),
    JSON.stringify({ name: 'goalrun-install-smoke', private: true }, null, 2),
    'utf-8',
  );

  run('npm', ['install', '--no-audit', '--no-fund', ...tarballs], {
    cwd: tempDir,
    stdio: 'inherit',
    timeout: 180000,
  });

  const [versionCmd, ...versionArgs] = plan.commands[1];
  const version = run(versionCmd, versionArgs, {
    cwd: tempDir,
    timeout: 30000,
  }).trim();

  if (version !== plan.expectedVersion) {
    throw new Error(
      `Installed goalrun version mismatch: expected ${plan.expectedVersion}, got ${version}`,
    );
  }

  console.log(`Install smoke passed: goalrun ${version}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
