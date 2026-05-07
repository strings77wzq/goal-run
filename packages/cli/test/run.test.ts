import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, execSync } from 'node:child_process';

async function createInitializedRepo(): Promise<string> {
  const tempDir = mkdtempSync(join(tmpdir(), 'goalrun-run-test-'));
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

  const { initCommand } = await import('../src/commands/init.js');
  const { skillInstallCommand } = await import('../src/commands/skill-install.js');

  await initCommand({ force: false });
  await skillInstallCommand(['tdd-change', 'code-review', 'implementation-strategy'], {
    force: false,
  });

  execSync('git init', { cwd: tempDir });
  execSync('git config user.email "test@test.com"', { cwd: tempDir });
  execSync('git config user.name "Test"', { cwd: tempDir });
  writeFileSync(resolve(tempDir, 'README.md'), '# Test repo\n', 'utf-8');
  execSync('git add . && git commit -m "initial"', { cwd: tempDir });

  return tempDir;
}

describe('runCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not create run artifacts, worktrees, or branches during isolated dry-run', async () => {
    const tempDir = await createInitializedRepo();
    const beforeWorktrees = execSync('git worktree list --porcelain', {
      cwd: tempDir,
      encoding: 'utf-8',
    });
    const beforeBranches = execFileSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    const { runCommand } = await import('../src/commands/run.js');
    await runCommand('.goalrun/goals/example-fix-bug.yaml', {
      dryRun: true,
      isolated: true,
      loop: true,
      json: false,
    });

    const runsDir = resolve(tempDir, '.goalrun/runs');
    const afterWorktrees = execSync('git worktree list --porcelain', {
      cwd: tempDir,
      encoding: 'utf-8',
    });
    const afterBranches = execFileSync('git', ['branch', '--format=%(refname:short)'], {
      cwd: tempDir,
      encoding: 'utf-8',
    });

    expect(existsSync(runsDir)).toBe(false);
    expect(afterWorktrees).toBe(beforeWorktrees);
    expect(afterBranches).toBe(beforeBranches);

    rmSync(tempDir, { recursive: true, force: true });
  });
});
