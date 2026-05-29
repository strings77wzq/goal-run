import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  loadLessons,
  searchLessons,
  addLesson,
  nominateFromRun,
} from '../src/lessons.js';
import type { Lesson } from '../src/lessons.js';

const TEST_DIR = resolve('/tmp', `goalrun-lessons-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
  mkdirSync(resolve(TEST_DIR, '.goalrun'), { recursive: true });
});

afterEach(() => {
  rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('loadLessons', () => {
  it('returns empty when no lessons file exists', () => {
    const result = loadLessons(TEST_DIR);
    expect(result.lessons).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('loads lessons from JSON file', () => {
    const lessons = {
      version: 1,
      lessons: [
        {
          id: 'lesson-1',
          pattern: 'tdd_skip',
          lesson: 'Always write failing test first',
          severity: 'warning',
          source_run: 'test',
          timestamp: '2026-01-01T00:00:00Z',
          tags: ['tdd'],
        },
      ],
    };
    writeFileSync(resolve(TEST_DIR, '.goalrun', 'lessons.json'), JSON.stringify(lessons));

    const result = loadLessons(TEST_DIR);
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0]?.pattern).toBe('tdd_skip');
  });

  it('loads lessons from markdown file', () => {
    const md = `# Lessons

## LESSON-001: tdd_skip
**Lesson**: Always write failing test first
**Severity**: warning
**Tags**: tdd, testing
`;
    writeFileSync(resolve(TEST_DIR, '.goalrun', 'lessons.md'), md);

    const result = loadLessons(TEST_DIR);
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0]?.pattern).toBe('tdd_skip');
  });

  it('prefers JSON over markdown', () => {
    const lessons = {
      version: 1,
      lessons: [{ id: 'json', pattern: 'from_json', lesson: 'JSON lesson', severity: 'info', source_run: 'test', timestamp: '2026-01-01T00:00:00Z', tags: [] }],
    };
    writeFileSync(resolve(TEST_DIR, '.goalrun', 'lessons.json'), JSON.stringify(lessons));
    writeFileSync(resolve(TEST_DIR, '.goalrun', 'lessons.md'), '## LESSON-001: from_md\n**Lesson**: MD lesson\n**Severity**: info\n');

    const result = loadLessons(TEST_DIR);
    expect(result.lessons[0]?.pattern).toBe('from_json');
  });
});

describe('searchLessons', () => {
  const lessons: Lesson[] = [
    { id: '1', pattern: 'tdd_skip', lesson: 'Always write failing test first', severity: 'warning', source_run: 'test', timestamp: '', tags: ['tdd'] },
    { id: '2', pattern: 'boundary_violation', lesson: 'Stay within file boundaries', severity: 'error', source_run: 'test', timestamp: '', tags: ['boundary'] },
    { id: '3', pattern: 'security_scan', lesson: 'Run security scan before commit', severity: 'warning', source_run: 'test', timestamp: '', tags: ['security'] },
  ];

  it('finds lessons by pattern keyword', () => {
    const result = searchLessons(lessons, ['tdd']);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe('1');
  });

  it('finds lessons by tag', () => {
    const result = searchLessons(lessons, ['boundary']);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe('2');
  });

  it('finds lessons by lesson text', () => {
    const result = searchLessons(lessons, ['security']);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.id).toBe('3');
  });

  it('returns empty for no matches', () => {
    const result = searchLessons(lessons, ['nonexistent']);
    expect(result.matches).toHaveLength(0);
  });

  it('returns empty for empty keywords', () => {
    const result = searchLessons(lessons, []);
    expect(result.matches).toHaveLength(0);
  });
});

describe('addLesson', () => {
  it('creates lessons.json if it does not exist', () => {
    const result = addLesson(TEST_DIR, {
      pattern: 'test_pattern',
      lesson: 'test lesson',
      severity: 'warning',
      source_run: 'test-run',
      tags: ['test'],
    });

    expect(result.success).toBe(true);
    expect(existsSync(resolve(TEST_DIR, '.goalrun', 'lessons.json'))).toBe(true);
  });

  it('appends to existing lessons.json', () => {
    addLesson(TEST_DIR, { pattern: 'first', lesson: 'first lesson', severity: 'info', source_run: 'test', tags: [] });
    addLesson(TEST_DIR, { pattern: 'second', lesson: 'second lesson', severity: 'warning', source_run: 'test', tags: [] });

    const result = loadLessons(TEST_DIR);
    expect(result.lessons).toHaveLength(2);
  });
});

describe('nominateFromRun', () => {
  it('returns empty when no verification results exist', () => {
    const runDir = resolve(TEST_DIR, '.goalrun', 'runs', 'test-run');
    mkdirSync(runDir, { recursive: true });

    const result = nominateFromRun(TEST_DIR, runDir);
    expect(result.nominated).toEqual([]);
  });

  it('nominates failed verification results as lessons', () => {
    const runDir = resolve(TEST_DIR, '.goalrun', 'runs', 'test-run');
    const verDir = resolve(runDir, 'verification');
    mkdirSync(verDir, { recursive: true });

    writeFileSync(resolve(verDir, 'advance-results.json'), JSON.stringify({
      results: [
        { name: 'tdd_evidence', passed: false, detail: 'Missing red-phase.txt' },
        { name: 'auto_verification', passed: true, detail: 'All passed' },
        { name: 'destructive:src/foo.ts', passed: false, detail: '10 lines deleted' },
      ],
    }));

    const result = nominateFromRun(TEST_DIR, runDir);
    expect(result.nominated).toHaveLength(2);
    expect(result.nominated[0]?.tags).toContain('tdd');
    expect(result.nominated[1]?.tags).toContain('destructive');
  });
});
