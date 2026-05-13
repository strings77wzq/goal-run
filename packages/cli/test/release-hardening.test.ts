import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '../../..');
const releaseUtilsUrl = pathToFileURL(resolve(repoRoot, 'scripts/release-utils.mjs')).href;

async function loadReleaseUtils(): Promise<{
  getPublishablePackages: (root: string) => { dir: string; name: string; version: string }[];
  checkVersionConsistency: (root: string) => { version: string; packages: string[] };
  createInstallSmokePlan: (
    root: string,
    packDir: string,
  ) => {
    cliTarball: string;
    expectedVersion: string;
    commands: string[][];
  };
  validateDistTags: (
    packages: { name: string }[],
    tag: string,
    expectedVersion: string,
    readTags: (packageName: string) => Record<string, string | undefined>,
  ) => string[];
  assertTarballIsPublishScoped: (entries: string[]) => void;
  cleanPackDir: (root: string, packDir: string) => string;
}> {
  return (await import(releaseUtilsUrl)) as Awaited<ReturnType<typeof loadReleaseUtils>>;
}

describe('release/install hardening', () => {
  it('discovers publishable package directories without including the workspace root', async () => {
    const { getPublishablePackages } = await loadReleaseUtils();

    const packages = getPublishablePackages(repoRoot);

    expect(packages.map((pkg) => pkg.dir).sort()).toEqual([
      'packages/cli',
      'packages/core',
      'packages/harness',
      'packages/reporter',
      'packages/security',
    ]);
    expect(packages.map((pkg) => pkg.name)).toContain('goalrun');
    expect(packages.every((pkg) => pkg.dir !== '.')).toBe(true);
  });

  it('checks workspace package version consistency and reports mismatches', async () => {
    const { checkVersionConsistency } = await loadReleaseUtils();

    expect(checkVersionConsistency(repoRoot).version).toBe('0.1.0-alpha.6');

    const fixtureRoot = mkdtempSync(resolve(tmpdir(), 'goalrun-version-fixture-'));
    try {
      writeJson(resolve(fixtureRoot, 'package.json'), {
        name: 'fixture-root',
        version: '1.0.0',
        private: true,
      });
      writeJson(resolve(fixtureRoot, 'packages/core/package.json'), {
        name: 'goalrun-core',
        version: '1.0.0',
      });
      writeJson(resolve(fixtureRoot, 'packages/cli/package.json'), {
        name: 'goalrun',
        version: '2.0.0',
      });

      expect(() => checkVersionConsistency(fixtureRoot)).toThrow(/Version mismatch/);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('plans install smoke around the packed CLI tarball and installed goalrun binary', async () => {
    const { createInstallSmokePlan } = await loadReleaseUtils();
    const expectedVersion = JSON.parse(
      readFileSync(resolve(repoRoot, 'packages/cli/package.json'), 'utf-8'),
    ).version as string;

    const plan = createInstallSmokePlan(repoRoot, '.goalrun/release-pack');

    expect(plan.cliTarball).toMatch(new RegExp(`goalrun-${expectedVersion}\\.tgz$`));
    expect(plan.expectedVersion).toBe(expectedVersion);
    expect(plan.commands).toContainEqual(['npm', 'install', plan.cliTarball]);
    expect(plan.commands).toContainEqual(['node_modules/.bin/goalrun', '--version']);
  });

  it('rejects pack output directories outside the repo before cleanup', async () => {
    const { cleanPackDir } = await loadReleaseUtils();

    expect(() => cleanPackDir(repoRoot, '../outside')).toThrow(/within the repository/);
    expect(() => cleanPackDir(repoRoot, '/tmp/goalrun-pack-outside')).toThrow(
      /within the repository/,
    );
    expect(() => cleanPackDir(repoRoot, '.')).toThrow(/must not be the repository root/);
  });

  it('reports dist-tag drift without mutating npm state', async () => {
    const { validateDistTags } = await loadReleaseUtils();

    const drifts = validateDistTags(
      [{ name: 'goalrun' }, { name: 'goalrun-core' }],
      'alpha',
      '0.1.0-alpha.6',
      (packageName) => ({
        alpha: packageName === 'goalrun' ? '0.1.0-alpha.5' : '0.1.0-alpha.6',
      }),
    );

    expect(drifts).toEqual(['goalrun@alpha: expected 0.1.0-alpha.6, actual 0.1.0-alpha.5']);
  });

  it('keeps runtime/build state out of formatting while leaving OpenSpec trackable', () => {
    const prettierIgnore = readFileSync(resolve(repoRoot, '.prettierignore'), 'utf-8');
    const gitIgnore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf-8');

    for (const pattern of [
      '.omx/',
      '.goalrun/runs/',
      '.goalrun/release-pack/',
      'dist/',
      '*.tsbuildinfo',
    ]) {
      expect(prettierIgnore).toContain(pattern);
    }
    expect(gitIgnore).toContain('.omx/');
    expect(gitIgnore).not.toMatch(/^openspec\/$/m);
    expect(existsSync(resolve(repoRoot, 'openspec/specs/runtime-handoff-contract/spec.md'))).toBe(
      true,
    );
  });

  it('gates release workflow and avoids unqualified npx goalrun in consumer template', () => {
    const releaseWorkflow = readFileSync(
      resolve(repoRoot, '.github/workflows/release.yml'),
      'utf-8',
    );
    const actionTemplate = readFileSync(
      resolve(repoRoot, 'templates/github-action/goalrun.yml'),
      'utf-8',
    );

    expect(releaseWorkflow).toContain('workflow_dispatch:');
    expect(releaseWorkflow).toContain('id-token: write');
    expect(releaseWorkflow).toContain('NPM_TOKEN');
    expect(releaseWorkflow).toContain('pnpm release:install-smoke');
    expect(releaseWorkflow).toContain('pnpm release:verify-tags');
    expect(releaseWorkflow).toContain('confirm_latest');

    expect(actionTemplate).toContain('GOALRUN_VERSION');
    expect(actionTemplate).toContain('npm install --global "goalrun@${GOALRUN_VERSION}"');
    expect(actionTemplate).not.toContain('npx goalrun');
  });

  it('rejects tarball entries containing runtime state, source-only paths, and sensitive config files', async () => {
    const { assertTarballIsPublishScoped } = await loadReleaseUtils();

    // Legitimate entries should pass
    expect(() =>
      assertTarballIsPublishScoped([
        'package/package.json',
        'package/dist/index.js',
        'package/README.md',
        'package/bin/goalrun.js',
      ]),
    ).not.toThrow();

    // Runtime state
    expect(() =>
      assertTarballIsPublishScoped(['package/dist/index.js', 'package/.omx/state.json']),
    ).toThrow('Tarball includes non-publishable files');

    expect(() => assertTarballIsPublishScoped(['package/.goalrun/runs/last-run.json'])).toThrow(
      'Tarball includes non-publishable files',
    );

    // Source-only test directories
    expect(() =>
      assertTarballIsPublishScoped(['package/dist/index.js', 'package/test/foo.test.ts']),
    ).toThrow('Tarball includes non-publishable files');

    // Sensitive config files
    expect(() => assertTarballIsPublishScoped(['package/dist/index.js', 'package/.env'])).toThrow(
      'Tarball includes non-publishable files',
    );

    expect(() => assertTarballIsPublishScoped(['package/dist/index.js', 'package/.npmrc'])).toThrow(
      'Tarball includes non-publishable files',
    );

    expect(() => assertTarballIsPublishScoped(['package/.credentials/token'])).toThrow(
      'Tarball includes non-publishable files',
    );
  });
});

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), 'utf-8');
}
