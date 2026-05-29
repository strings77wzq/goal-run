import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Diagnostic } from './diagnostic.js';
import { createWarning } from './diagnostic.js';

export interface Lesson {
  id: string;
  pattern: string;
  lesson: string;
  severity: 'info' | 'warning' | 'error';
  source_run: string;
  timestamp: string;
  tags: string[];
}

export interface LessonsFile {
  version: number;
  lessons: Lesson[];
}

export interface LessonsSearchResult {
  matches: Lesson[];
  diagnostics: Diagnostic[];
}

const DEFAULT_LESSONS_PATH = '.goalrun/lessons.md';
const LESSONS_JSON_PATH = '.goalrun/lessons.json';

/**
 * Load lessons from .goalrun/lessons.json (structured) or lessons.md (legacy).
 */
export function loadLessons(repoRoot: string): { lessons: Lesson[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const jsonPath = resolve(repoRoot, LESSONS_JSON_PATH);
  const mdPath = resolve(repoRoot, DEFAULT_LESSONS_PATH);

  // Prefer structured JSON
  if (existsSync(jsonPath)) {
    try {
      const raw = readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as LessonsFile;
      return { lessons: parsed.lessons ?? [], diagnostics };
    } catch {
      diagnostics.push(
        createWarning('LESSONS_PARSE_ERROR', 'Failed to parse lessons.json, falling back to md', {
          file: jsonPath,
        }),
      );
    }
  }

  // Fallback: parse markdown
  if (existsSync(mdPath)) {
    try {
      const content = readFileSync(mdPath, 'utf-8');
      const lessons = parseLessonsMd(content);
      return { lessons, diagnostics };
    } catch {
      diagnostics.push(
        createWarning('LESSONS_PARSE_ERROR', 'Failed to parse lessons.md', { file: mdPath }),
      );
    }
  }

  return { lessons: [], diagnostics };
}

/**
 * Search lessons by keywords. Matches against pattern, lesson text, and tags.
 */
export function searchLessons(lessons: Lesson[], keywords: string[]): LessonsSearchResult {
  if (keywords.length === 0) return { matches: [], diagnostics: [] };

  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  const matches = lessons.filter((lesson) => {
    const searchable = [lesson.pattern, lesson.lesson, ...lesson.tags].join(' ').toLowerCase();
    return lowerKeywords.some((kw) => searchable.includes(kw));
  });

  return { matches, diagnostics: [] };
}

/**
 * Add a new lesson to the structured lessons file.
 */
export function addLesson(
  repoRoot: string,
  lesson: Omit<Lesson, 'id' | 'timestamp'>,
): { success: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const jsonPath = resolve(repoRoot, LESSONS_JSON_PATH);

  const newLesson: Lesson = {
    ...lesson,
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  let existing: LessonsFile = { version: 1, lessons: [] };

  if (existsSync(jsonPath)) {
    try {
      existing = JSON.parse(readFileSync(jsonPath, 'utf-8')) as LessonsFile;
    } catch {
      diagnostics.push(
        createWarning('LESSONS_PARSE_ERROR', 'Could not parse existing lessons.json, overwriting', {
          file: jsonPath,
        }),
      );
    }
  }

  existing.lessons.push(newLesson);

  try {
    mkdirSync(dirname(jsonPath), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(existing, null, 2), 'utf-8');
    return { success: true, diagnostics };
  } catch (err) {
    diagnostics.push(
      createWarning('LESSONS_WRITE_ERROR', `Failed to write lessons.json: ${String(err)}`, {
        file: jsonPath,
      }),
    );
    return { success: false, diagnostics };
  }
}

/**
 * Nominate failure patterns from a run's verification results.
 * Scans for failed verification commands and destructive changes.
 */
export function nominateFromRun(
  repoRoot: string,
  runDir: string,
): { nominated: Lesson[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const nominated: Lesson[] = [];

  const resultsPath = resolve(runDir, 'verification', 'advance-results.json');
  if (!existsSync(resultsPath)) {
    return { nominated, diagnostics };
  }

  try {
    const raw = JSON.parse(readFileSync(resultsPath, 'utf-8')) as {
      results?: { name: string; passed: boolean; detail: string }[];
    };

    for (const result of raw.results ?? []) {
      if (!result.passed) {
        const lesson: Lesson = {
          id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          pattern: result.name,
          lesson: result.detail,
          severity: result.name.startsWith('destructive:') ? 'error' : 'warning',
          source_run: runDir,
          timestamp: new Date().toISOString(),
          tags: extractTags(result.name, result.detail),
        };
        nominated.push(lesson);
      }
    }
  } catch {
    diagnostics.push(
      createWarning(
        'LESSONS_NOMINATE_ERROR',
        'Failed to read verification results for lesson nomination',
        { file: resultsPath },
      ),
    );
  }

  return { nominated, diagnostics };
}

/**
 * Extract searchable tags from a failure name and detail.
 */
function extractTags(name: string, detail: string): string[] {
  const tags: string[] = [];
  const combined = `${name} ${detail}`.toLowerCase();

  const tagPatterns = [
    { pattern: /tdd|red.?phase|green.?phase/, tag: 'tdd' },
    { pattern: /destructive|delete|remove/, tag: 'destructive' },
    { pattern: /boundary|out.?of.?bounds/, tag: 'boundary' },
    { pattern: /test|spec|coverage/, tag: 'testing' },
    { pattern: /security|secret|inject/, tag: 'security' },
    { pattern: /type|typecheck|tsc/, tag: 'types' },
    { pattern: /lint|eslint|prettier/, tag: 'lint' },
    { pattern: /build|compile/, tag: 'build' },
  ];

  for (const { pattern, tag } of tagPatterns) {
    if (pattern.test(combined)) tags.push(tag);
  }

  return tags.length > 0 ? tags : ['general'];
}

/**
 * Parse lessons from a markdown file.
 * Expected format:
 * ## LESSON-001: pattern description
 * **Lesson**: what to remember
 * **Severity**: warning
 * **Tags**: tdd, testing
 */
function parseLessonsMd(content: string): Lesson[] {
  const lessons: Lesson[] = [];
  const sections = content.split(/^## LESSON-/m).slice(1);

  for (const section of sections) {
    const lines = section.trim().split('\n');
    const headerLine = lines[0] ?? '';
    const idMatch = /^(\d+):\s*(.*)/.exec(headerLine);
    if (!idMatch) continue;

    const id = `LESSON-${idMatch[1]}`;
    const pattern = idMatch[2]?.trim() ?? '';

    let lesson = '';
    let severity: 'info' | 'warning' | 'error' = 'warning';
    let tags: string[] = [];

    for (const line of lines.slice(1)) {
      const lessonMatch = /^\*\*Lesson\*\*:\s*(.*)/.exec(line);
      const severityMatch = /^\*\*Severity\*\*:\s*(.*)/.exec(line);
      const tagsMatch = /^\*\*Tags\*\*:\s*(.*)/.exec(line);

      if (lessonMatch) lesson = lessonMatch[1]?.trim() ?? '';
      if (severityMatch) {
        const s = severityMatch[1]?.trim().toLowerCase();
        if (s === 'info' || s === 'warning' || s === 'error') severity = s;
      }
      if (tagsMatch) tags = (tagsMatch[1] ?? '').split(',').map((t) => t.trim());
    }

    if (pattern && lesson) {
      lessons.push({
        id,
        pattern,
        lesson,
        severity,
        source_run: 'manual',
        timestamp: new Date().toISOString(),
        tags,
      });
    }
  }

  return lessons;
}
