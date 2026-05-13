import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

export const DEFAULT_PACK_DIR = '.goalrun/release-pack';

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function getPublishablePackages(root = process.cwd()) {
  const packagesDir = resolve(root, 'packages');
  if (!existsSync(packagesDir)) return [];

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}`)
    .filter((dir) => existsSync(resolve(root, dir, 'package.json')))
    .map((dir) => {
      const pkg = readJson(resolve(root, dir, 'package.json'));
      return {
        dir,
        name: pkg.name,
        version: pkg.version,
        private: Boolean(pkg.private),
      };
    })
    .filter((pkg) => !pkg.private)
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

export function checkVersionConsistency(root = process.cwd()) {
  const rootPkg = readJson(resolve(root, 'package.json'));
  const packages = [
    { dir: '.', name: rootPkg.name, version: rootPkg.version },
    ...getPublishablePackages(root),
  ];
  const versions = new Map();

  for (const pkg of packages) {
    const existing = versions.get(pkg.version) ?? [];
    existing.push(`${pkg.name} (${pkg.dir})`);
    versions.set(pkg.version, existing);
  }

  if (versions.size !== 1) {
    const details = [...versions.entries()]
      .map(([version, names]) => `  ${version}: ${names.join(', ')}`)
      .join('\n');
    throw new Error(`Version mismatch detected:\n${details}`);
  }

  return {
    version: rootPkg.version,
    packages: packages.map((pkg) => pkg.name),
  };
}

export function createInstallSmokePlan(root = process.cwd(), packDir = DEFAULT_PACK_DIR) {
  const cliPkg = readJson(resolve(root, 'packages/cli/package.json'));
  const cliTarball = resolve(
    root,
    packDir,
    `${tarballBaseName(cliPkg.name)}-${cliPkg.version}.tgz`,
  );

  return {
    cliTarball,
    expectedVersion: cliPkg.version,
    commands: [
      ['npm', 'install', cliTarball],
      ['node_modules/.bin/goalrun', '--version'],
    ],
  };
}

export function tarballBaseName(packageName) {
  return packageName.replace(/^@/, '').replace('/', '-');
}

export function cleanPackDir(root = process.cwd(), packDir = DEFAULT_PACK_DIR) {
  const contained = resolveContainedPath(root, packDir);
  if (!contained.success) {
    throw new Error(contained.error);
  }

  const fullPackDir = contained.path;
  rmSync(fullPackDir, { recursive: true, force: true });
  mkdirSync(fullPackDir, { recursive: true });
  return fullPackDir;
}

export function resolveContainedPath(root, candidatePath) {
  const fullPath = resolve(root, candidatePath);
  const rel = relative(root, fullPath);

  if (rel === '') {
    return { success: false, error: 'Pack output directory must not be the repository root.' };
  }

  if (rel === '..' || rel.startsWith('../') || isAbsolute(rel)) {
    return { success: false, error: 'Pack output directory must be within the repository.' };
  }

  return { success: true, path: fullPath };
}

export function expectedTarballPath(root, packDir, pkg) {
  return resolve(root, packDir, `${tarballBaseName(pkg.name)}-${pkg.version}.tgz`);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf-8',
    stdio: options.stdio ?? 'pipe',
    env: options.env ?? process.env,
    timeout: options.timeout ?? 120000,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const rendered = [command, ...args].join(' ');
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${rendered} failed with exit ${result.status}\n${output}`);
  }

  return result.stdout;
}

export function assertTarballIsPublishScoped(entries) {
  const blocked = entries.filter(
    (entry) =>
      entry.includes('/.omx/') ||
      entry.includes('/.goalrun/runs/') ||
      entry.includes('/node_modules/') ||
      entry.includes('/test/') ||
      entry.startsWith('package/src/') ||
      entry.endsWith('/.env') ||
      entry.endsWith('/.npmrc') ||
      entry.includes('/.credentials') ||
      entry.endsWith('/.env.local') ||
      entry.endsWith('/.env.production') ||
      entry.includes('/secrets/'),
  );

  if (blocked.length > 0) {
    throw new Error(`Tarball includes non-publishable files:\n${blocked.join('\n')}`);
  }
}

export function validateDistTags(packages, tag, expectedVersion, readTags) {
  const drifts = [];

  for (const pkg of packages) {
    const tags = readTags(pkg.name);
    const actual = tags[tag];
    if (actual !== expectedVersion) {
      drifts.push(
        `${pkg.name}@${tag}: expected ${expectedVersion}, actual ${actual ?? '<missing>'}`,
      );
    }
  }

  return drifts;
}

export function listTarballEntries(tarballPath) {
  return run('tar', ['-tzf', tarballPath], { timeout: 30000 }).trim().split('\n').filter(Boolean);
}
