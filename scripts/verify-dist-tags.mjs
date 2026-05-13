#!/usr/bin/env node
import { readJson, getPublishablePackages, run, validateDistTags } from './release-utils.mjs';
import { resolve } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2).filter((arg) => arg !== '--');
const tag = args[0] || process.env.GOALRUN_NPM_TAG || 'alpha';
const expectedVersion = args[1] || readJson(resolve(root, 'package.json')).version;
const packages = getPublishablePackages(root);
const failedReads = [];
const tagMap = new Map();

for (const pkg of packages) {
  try {
    const raw = run('npm', ['view', pkg.name, 'dist-tags', '--json'], {
      cwd: root,
      timeout: 60000,
    });
    tagMap.set(pkg.name, JSON.parse(raw));
  } catch (err) {
    failedReads.push(
      `${pkg.name}: failed to read dist-tags (${err instanceof Error ? err.message : String(err)})`,
    );
  }
}

const drifts = [
  ...failedReads,
  ...validateDistTags(
    packages,
    tag,
    expectedVersion,
    (packageName) => tagMap.get(packageName) ?? {},
  ),
];

if (drifts.length > 0) {
  console.error(`Dist-tag drift detected for tag "${tag}":`);
  for (const drift of drifts) {
    console.error(`  ${drift}`);
  }
  process.exit(1);
}

console.log(`All publishable packages have ${tag} -> ${expectedVersion}`);
