/**
 * Smoke test: exercises the full init → install → plan → verify flow
 * in a temporary directory. Mocks process.cwd() so commands operate
 * on the temp directory while templates/skills are loaded from the
 * real monorepo paths.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

// Capture real monorepo paths BEFORE any mocking
const REAL_MONOREPO_ROOT = resolve(import.meta.dirname ?? '', '..', '..', '..');

// Mock config module to return real template/skill paths
vi.mock('../src/utils/config.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/utils/config.js')>('../src/utils/config.js');
  const monorepoRoot = REAL_MONOREPO_ROOT;
  return {
    ...actual,
    getTemplatesDir: () => resolve(monorepoRoot, 'templates'),
    getBuiltinSkillsDir: () => resolve(monorepoRoot, 'skills'),
    loadConfig: actual.loadConfig,
  };
});

describe('CLI smoke test (full workflow)', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(resolve(tmpdir(), 'goalrun-smoke-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
  });

  afterAll(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('goalrun init creates expected scaffold files', async () => {
    const { initCommand } = await import('../src/commands/init.js');
    await initCommand({ force: false });

    expect(existsSync(resolve(tempDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(resolve(tempDir, '.goalrun/config.yaml'))).toBe(true);
    expect(existsSync(resolve(tempDir, '.goalrun/policy.yaml'))).toBe(true);
    expect(existsSync(resolve(tempDir, '.goalrun/goals/example-fix-bug.yaml'))).toBe(true);
    expect(existsSync(resolve(tempDir, '.goalrun/tests/selection.yaml'))).toBe(true);
  });

  it('goalrun skill install installs built-in skills', async () => {
    const { skillInstallCommand } = await import('../src/commands/skill-install.js');
    await skillInstallCommand(['tdd-change', 'code-review', 'implementation-strategy'], {
      force: false,
    });

    expect(existsSync(resolve(tempDir, '.agent/skills/tdd-change/SKILL.md'))).toBe(true);
    expect(existsSync(resolve(tempDir, '.agent/skills/code-review/SKILL.md'))).toBe(true);
    expect(existsSync(resolve(tempDir, '.agent/skills/implementation-strategy/SKILL.md'))).toBe(
      true,
    );
    expect(existsSync(resolve(tempDir, 'goalrun.lock'))).toBe(true);
  });

  it('goalrun plan generates execution plan for example goal', async () => {
    const { planCommand } = await import('../src/commands/plan.js');
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null) => {
        throw new Error(`process.exit(${code})`);
      });

    await planCommand('.goalrun/goals/example-fix-bug.yaml', { json: false });

    mockExit.mockRestore();
    // If we got here without process.exit(1), plan succeeded
    expect(true).toBe(true);
  });

  it('goalrun verify runs all harnesses on the example goal', async () => {
    const { verifyCommand } = await import('../src/commands/verify.js');
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null) => {
        if (code === 1) throw new Error('process.exit(1)');
      });

    await verifyCommand('.goalrun/goals/example-fix-bug.yaml', { json: false });

    mockExit.mockRestore();
    expect(true).toBe(true);
  });

  it('goalrun run --supervised --loop creates run directory', async () => {
    const mockExit = vi
      .spyOn(process, 'exit')
      .mockImplementation((code?: string | number | null) => {
        if (code === 1) throw new Error('process.exit(1)');
      });

    const { runCommand } = await import('../src/commands/run.js');
    await runCommand('.goalrun/goals/example-fix-bug.yaml', {
      supervised: true,
      loop: true,
      dryRun: false,
      json: false,
    });

    mockExit.mockRestore();

    const runsDir = resolve(tempDir, '.goalrun/runs');
    expect(existsSync(runsDir)).toBe(true);
  });
});
