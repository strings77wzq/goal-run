import { describe, it, expect } from 'vitest';
import { scanForBlockedCommands, isCommandBlocked } from '../src/blocked-commands.js';

const BLOCKED = ['rm -rf', 'npm publish', 'terraform apply', 'kubectl delete'];

describe('isCommandBlocked', () => {
  it('returns true for exact match', () => {
    expect(isCommandBlocked('rm -rf', BLOCKED)).toBe(true);
  });

  it('returns true for prefix match', () => {
    expect(isCommandBlocked('rm -rf /tmp/cache', BLOCKED)).toBe(true);
  });

  it('returns false for unrelated command', () => {
    expect(isCommandBlocked('pnpm test', BLOCKED)).toBe(false);
  });

  it('returns false for partial word match', () => {
    expect(isCommandBlocked('npm install', BLOCKED)).toBe(false);
  });
});

describe('scanForBlockedCommands', () => {
  it('returns empty for clean content', () => {
    const result = scanForBlockedCommands('pnpm install\npnpm test', 'script.sh', BLOCKED);
    expect(result).toHaveLength(0);
  });

  it('detects a single blocked command', () => {
    const result = scanForBlockedCommands('Run: npm publish', 'ci.yml', BLOCKED);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.code).toBe('BLOCKED_COMMAND');
    expect(result[0]!.file).toBe('ci.yml');
  });

  it('detects multiple blocked commands', () => {
    const content = 'Step 1: terraform apply\nStep 2: kubectl delete pod';
    const result = scanForBlockedCommands(content, 'runbook.md', BLOCKED);
    expect(result.length).toBe(2);
  });

  it('detects blocked commands in code blocks', () => {
    const content = '```bash\nrm -rf /\n```';
    const result = scanForBlockedCommands(content, 'README.md', BLOCKED);
    expect(result.length).toBeGreaterThan(0);
  });

  it('reports line numbers', () => {
    const content = 'line1\nline2\nnpm publish --tag latest';
    const result = scanForBlockedCommands(content, 'deploy.sh', BLOCKED);
    expect(result[0]?.line).toBe(3);
  });
});
