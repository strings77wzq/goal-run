import { describe, it, expect } from 'vitest';
import { parseIssueUrl, generateGoalFromIssue, generateGoalFromTitle } from '../src/from-issue.js';

describe('parseIssueUrl', () => {
  it('parses a valid GitHub issue URL', () => {
    const result = parseIssueUrl('https://github.com/owner/repo/issues/42');
    expect(result).not.toBeNull();
    expect(result!.owner).toBe('owner');
    expect(result!.repo).toBe('repo');
    expect(result!.issueNumber).toBe(42);
  });

  it('parses URL without https prefix', () => {
    const result = parseIssueUrl('github.com/org-name/project-name/issues/100');
    expect(result).not.toBeNull();
    expect(result!.owner).toBe('org-name');
    expect(result!.repo).toBe('project-name');
    expect(result!.issueNumber).toBe(100);
  });

  it('returns null for non-issue URL', () => {
    expect(parseIssueUrl('https://github.com/owner/repo/pull/42')).toBeNull();
    expect(parseIssueUrl('https://gitlab.com/owner/repo/issues/42')).toBeNull();
    expect(parseIssueUrl('not a url')).toBeNull();
  });
});

describe('generateGoalFromIssue', () => {
  it('generates a goal spec from issue info', () => {
    const yaml = generateGoalFromIssue({
      owner: 'myorg',
      repo: 'myrepo',
      issueNumber: 42,
      title: 'Fix login timeout bug',
      body: 'Users are logged out after 5 minutes instead of 30.',
    });

    expect(yaml).toContain('id: myrepo-issue-42');
    expect(yaml).toContain('Fix login timeout bug');
    expect(yaml).toContain('implementation-strategy');
    expect(yaml).toContain('tdd-change');
    expect(yaml).toContain('code-review');
    expect(yaml).toContain('pnpm test');
  });

  it('strips backticks from title', () => {
    const yaml = generateGoalFromIssue({
      owner: 'x',
      repo: 'y',
      issueNumber: 1,
      title: 'Fix `null` reference in auth',
      body: 'Bug report',
    });

    expect(yaml).toContain('Fix null reference in auth');
    expect(yaml).not.toContain('`');
  });
});

describe('generateGoalFromTitle', () => {
  it('generates a goal spec from a title string', () => {
    const yaml = generateGoalFromTitle('Add rate limiter middleware');

    expect(yaml).toContain('id: add-rate-limiter-middleware');
    expect(yaml).toContain('Add rate limiter middleware');
    expect(yaml).toContain('skills:');
    expect(yaml).toContain('criteria:');
    expect(yaml).toContain('budget:');
  });
});
