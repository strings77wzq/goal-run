import { resolve } from 'node:path';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { resolveRunDir } from '../utils/run-dir.js';
import {
  nominateFromRun,
  addLesson,
  isTerminal,
  type RunState,
} from 'goalrun-core';

export async function archiveCommand(
  runId: string,
  opts: { json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runDir = resolveRunDir(repoRoot, config.runs_dir, runId);
  const statusPath = resolve(runDir, 'status.json');

  if (!existsSync(statusPath)) {
    console.error(pc.red(`Run "${runId}" not found.`));
    process.exit(1);
  }

  let state: RunState;
  try {
    state = JSON.parse(readFileSync(statusPath, 'utf-8')) as RunState;
  } catch {
    console.error(pc.red(`Failed to parse status.json for "${runId}"`));
    process.exit(1);
  }

  if (!isTerminal(state.status)) {
    console.error(pc.red(`Run "${runId}" is not in a terminal state (current: ${state.status}).`));
    console.error(pc.dim('Only completed, failed, or stopped runs can be archived.'));
    process.exit(1);
  }

  // 1. Nominate lessons from verification results
  const { nominated, diagnostics: nominateDiags } = nominateFromRun(repoRoot, runDir);

  // 2. Save lessons to lessons.json
  let lessonsAdded = 0;
  for (const lesson of nominated) {
    const { success } = addLesson(repoRoot, lesson);
    if (success) lessonsAdded++;
  }

  // 3. Create archive marker
  const archivePath = resolve(runDir, 'archive.json');
  const archive = {
    run_id: runId,
    goal_id: state.goal_id,
    status: state.status,
    archived_at: new Date().toISOString(),
    iterations: state.iteration,
    criteria_passed: state.criteria.filter((c) => c.status === 'pass').length,
    criteria_total: state.criteria.length,
    lessons_nominated: nominated.length,
    lessons_added: lessonsAdded,
  };

  mkdirSync(resolve(archivePath, '..'), { recursive: true });
  writeFileSync(archivePath, JSON.stringify(archive, null, 2), 'utf-8');

  // 4. Generate summary
  const summaryPath = resolve(runDir, 'SUMMARY.md');
  const summary = [
    `# Run Summary: ${runId}`,
    '',
    `**Goal**: ${state.goal_id}`,
    `**Status**: ${state.status}`,
    `**Iterations**: ${state.iteration}/${state.max_iterations}`,
    `**Criteria**: ${archive.criteria_passed}/${archive.criteria_total} passed`,
    '',
    '## Criteria Details',
    '',
    ...state.criteria.map((c) => {
      const icon = c.status === 'pass' ? '✅' : c.status === 'fail' ? '❌' : '⏳';
      return `- ${icon} ${c.text}`;
    }),
    '',
    '## Lessons Learned',
    '',
    nominated.length > 0
      ? nominated.map((l) => `- **${l.pattern}**: ${l.lesson}`).join('\n')
      : 'No lessons nominated from this run.',
    '',
    `Archived at: ${archive.archived_at}`,
  ].join('\n');

  writeFileSync(summaryPath, summary, 'utf-8');

  // Output
  if (opts.json) {
    console.log(JSON.stringify({ archive, lessons: nominated }, null, 2));
  } else {
    console.log(pc.green(`Run "${runId}" archived.`));
    console.log('');
    console.log(`  Status: ${pc.bold(state.status)}`);
    console.log(`  Criteria: ${archive.criteria_passed}/${archive.criteria_total} passed`);
    console.log(`  Lessons nominated: ${nominated.length}`);
    console.log(`  Lessons added: ${lessonsAdded}`);
    console.log('');
    console.log(`  ${pc.dim('Archive:')} ${archivePath}`);
    console.log(`  ${pc.dim('Summary:')} ${summaryPath}`);

    if (nominated.length > 0) {
      console.log('');
      console.log(pc.bold('Lessons nominated:'));
      for (const lesson of nominated) {
        const icon = lesson.severity === 'error' ? pc.red('!') : pc.yellow('!');
        console.log(`  ${icon} ${lesson.pattern}: ${lesson.lesson}`);
      }
    }

    if (nominateDiags.length > 0) {
      console.log('');
      for (const d of nominateDiags) {
        console.log(pc.yellow(`  ⚠ ${d.message}`));
      }
    }

    console.log('');
    console.log(pc.dim('These lessons will be checked in future runs before dev tasks.'));
  }
}
