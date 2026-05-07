import { describe, it, expect } from 'vitest';
import { generateHandoff, TARGETS, type HandoffTarget } from '../src/adapter.js';

const SAMPLE_PLAN = {
  goalId: 'fix-bug',
  goalTitle: 'Fix login timeout',
  selectedSkills: ['implementation-strategy', 'tdd-change', 'code-review'],
  policyGates: ['changes_public_api'],
  verificationChecklist: ['pnpm test', 'pnpm typecheck'],
  riskSummary: ['Public API change requires approval'],
  diagnostics: [],
};

describe('TARGETS', () => {
  it('includes all 4 supported targets', () => {
    expect(TARGETS).toContain('claude');
    expect(TARGETS).toContain('codex');
    expect(TARGETS).toContain('cursor');
    expect(TARGETS).toContain('opencode');
  });
});

describe('generateHandoff', () => {
  const expectedSkillPaths: Record<HandoffTarget, string> = {
    claude: '.claude/skills/',
    codex: '.codex/skills/',
    cursor: '.cursor/skills/',
    opencode: '.opencode/skills/',
  };

  it('generates Claude Code prompt with system preamble', () => {
    const result = generateHandoff(SAMPLE_PLAN, 'claude');
    expect(result).toContain('Claude Code');
    expect(result).toContain('fix-bug');
    expect(result).toContain('implementation-strategy');
    expect(result).toContain('CLAUDE.md');
  });

  it('generates Codex prompt with .codex reference', () => {
    const result = generateHandoff(SAMPLE_PLAN, 'codex');
    expect(result).toContain('Codex');
    expect(result).toContain('.codex');
    expect(result).toContain('SKILL.md');
  });

  it('generates Cursor prompt with .cursorrules reference', () => {
    const result = generateHandoff(SAMPLE_PLAN, 'cursor');
    expect(result).toContain('Cursor');
    expect(result).toContain('.cursorrules');
  });

  it('generates OpenCode prompt with .opencode reference', () => {
    const result = generateHandoff(SAMPLE_PLAN, 'opencode');
    expect(result).toContain('OpenCode');
    expect(result).toContain('.opencode');
  });

  it('all targets include policy gates section', () => {
    for (const target of TARGETS) {
      const result = generateHandoff(SAMPLE_PLAN, target);
      expect(result).toContain('Policy Gates');
      expect(result).toContain('changes_public_api');
    }
  });

  it('all targets include verification checklist', () => {
    for (const target of TARGETS) {
      const result = generateHandoff(SAMPLE_PLAN, target);
      expect(result).toContain('pnpm test');
    }
  });

  it('uses target-specific skill paths consistently', () => {
    for (const target of TARGETS) {
      const result = generateHandoff(SAMPLE_PLAN, target);
      const expectedPath = expectedSkillPaths[target];

      expect(result).toContain(`${expectedPath}implementation-strategy/SKILL.md`);
      expect(result).toContain(`${expectedPath}<name>/SKILL.md`);
      expect(result).not.toContain('.agent/skills/implementation-strategy/SKILL.md');
      expect(result).not.toContain('.agent/skills/<name>/SKILL.md');
    }
  });

  it('throws for unknown target', () => {
    expect(() => generateHandoff(SAMPLE_PLAN, 'unknown' as HandoffTarget)).toThrow(
      /unsupported target/i,
    );
  });
});
