import { describe, it, expect } from 'vitest';
import { SkillMetadataSchema, parseSkillMd, type SkillMetadata } from '../src/skill-parser.js';

const VALID_FRONTMATTER = `---
name: tdd-change
description: Implement changes using test-driven development
version: "1.0.0"
risk: medium
permissions:
  - read_files
  - write_files
  - run_tests
when_to_use: Use for bugfix, feature, or behavior-changing refactor
when_not_to_use: Do not use for documentation-only changes
---
# tdd-change

Write tests first, then implement.
`;

const MINIMAL_FRONTMATTER = `---
name: minimal-skill
description: A minimal skill
version: "0.1.0"
risk: low
permissions:
  - read_files
---
# Minimal Skill

Just a minimal skill.
`;

const NO_FRONTMATTER = `# No frontmatter

This is just a markdown file.
`;

describe('SkillMetadataSchema', () => {
  it('validates a complete skill metadata', () => {
    const meta = {
      name: 'code-review',
      description: 'Review code changes for quality and security',
      version: '2.0.0',
      risk: 'high' as const,
      permissions: ['read_files', 'report_issues'],
      when_to_use: 'Before merging any PR',
      when_not_to_use: 'For trivial typo fixes',
    };
    const result = SkillMetadataSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it('validates minimal metadata (only required fields)', () => {
    const meta = {
      name: 'simple',
      description: 'A simple skill',
      version: '1.0.0',
      risk: 'low' as const,
      permissions: ['read_files'],
    };
    const result = SkillMetadataSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const result = SkillMetadataSchema.safeParse({
      description: 'x',
      version: '1.0.0',
      risk: 'low',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty permissions array', () => {
    const result = SkillMetadataSchema.safeParse({
      name: 'x',
      description: 'x',
      version: '1.0.0',
      risk: 'low',
      permissions: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid risk level', () => {
    const result = SkillMetadataSchema.safeParse({
      name: 'x',
      description: 'x',
      version: '1.0.0',
      risk: 'catastrophic',
      permissions: ['read_files'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing version', () => {
    const result = SkillMetadataSchema.safeParse({
      name: 'x',
      description: 'x',
      risk: 'low',
      permissions: ['read_files'],
    });
    expect(result.success).toBe(false);
  });
});

describe('parseSkillMd', () => {
  it('parses valid SKILL.md with complete frontmatter', () => {
    const result = parseSkillMd(VALID_FRONTMATTER, 'tdd-change/SKILL.md');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.name).toBe('tdd-change');
      expect(result.metadata.risk).toBe('medium');
      expect(result.metadata.permissions).toContain('read_files');
      expect(result.body).toContain('# tdd-change');
      expect(result.body).toContain('Write tests first');
    }
  });

  it('parses minimal frontmatter', () => {
    const result = parseSkillMd(MINIMAL_FRONTMATTER, 'minimal-skill/SKILL.md');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.name).toBe('minimal-skill');
    }
  });

  it('returns diagnostics for missing frontmatter', () => {
    const result = parseSkillMd(NO_FRONTMATTER, 'doc/SKILL.md');
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.code === 'SKILL_NO_FRONTMATTER')).toBe(true);
    }
  });

  it('returns diagnostics for invalid frontmatter schema', () => {
    const content = `---
name: ""
description: ""
version: "bad"
risk: unknown
permissions: not-an-array
---
# Bad skill`;
    const result = parseSkillMd(content, 'bad/SKILL.md');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    }
  });

  it('returns diagnostics for overly short description', () => {
    const content = `---
name: test-skill
description: "ok"
version: "1.0.0"
risk: low
permissions:
  - read_files
---
# test`;
    const result = parseSkillMd(content, 'test/SKILL.md');
    expect(result.success).toBe(true);
    if (result.success) {
      const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
      const shortDescWarn = warnings.find((w) => w.code === 'SKILL_SHORT_DESCRIPTION');
      expect(shortDescWarn).toBeDefined();
    }
  });

  it('returns diagnostics for name/directory mismatch', () => {
    const result = parseSkillMd(VALID_FRONTMATTER, 'wrong-name/SKILL.md');
    expect(result.success).toBe(true);
    if (result.success) {
      const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
      expect(warnings.some((w) => w.code === 'SKILL_NAME_MISMATCH')).toBe(true);
    }
  });
});
