import { describe, it, expect } from 'vitest';
import { PolicyConfigSchema, DEFAULT_POLICY, parsePolicyConfigSafe } from '../src/policy-schema.js';

describe('PolicyConfigSchema', () => {
  it('validates a complete policy config', () => {
    const config = {
      blocked_commands: ['rm -rf', 'npm publish'],
      require_approval_for: ['deletes_files', 'modifies_auth_code'],
    };
    expect(PolicyConfigSchema.safeParse(config).success).toBe(true);
  });

  it('validates empty arrays', () => {
    const config = { blocked_commands: [], require_approval_for: [] };
    expect(PolicyConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejects missing require_approval_for', () => {
    const result = PolicyConfigSchema.safeParse({ blocked_commands: [] });
    expect(result.success).toBe(false);
  });

  it('rejects string instead of array', () => {
    const result = PolicyConfigSchema.safeParse({
      blocked_commands: 'rm -rf',
      require_approval_for: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('DEFAULT_POLICY', () => {
  it('has blocked_commands', () => {
    expect(DEFAULT_POLICY.blocked_commands).toContain('rm -rf');
    expect(DEFAULT_POLICY.blocked_commands).toContain('npm publish');
  });

  it('has approval categories', () => {
    expect(DEFAULT_POLICY.require_approval_for).toContain('changes_public_api');
    expect(DEFAULT_POLICY.require_approval_for).toContain('modifies_auth_code');
  });

  it('passes schema validation', () => {
    expect(PolicyConfigSchema.safeParse(DEFAULT_POLICY).success).toBe(true);
  });
});

describe('parsePolicyConfigSafe', () => {
  it('parses valid policy YAML', () => {
    const yaml = `
blocked_commands:
  - rm -rf
  - git push --force
require_approval_for:
  - changes_public_api
  - deletes_files
`;
    const result = parsePolicyConfigSafe(yaml, 'policy.yaml');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.config.blocked_commands).toContain('git push --force');
      expect(result.config.require_approval_for).toContain('deletes_files');
    }
  });

  it('returns diagnostics for invalid YAML', () => {
    const result = parsePolicyConfigSafe('{ bad: [', 'policy.yaml');
    expect(result.success).toBe(false);
  });

  it('returns diagnostics for empty YAML', () => {
    const result = parsePolicyConfigSafe('', 'policy.yaml');
    expect(result.success).toBe(false);
  });
});
