import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { compareRuns, type RunState } from 'goalrun-core';

export async function compareCommand(
  runIdA: string,
  runIdB: string,
  opts: { json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  const runsDir = resolve(repoRoot, config.runs_dir);

  const stateA = loadRun(runsDir, runIdA);
  const stateB = loadRun(runsDir, runIdB);

  if (!stateA) {
    console.error(pc.red(`Run "${runIdA}" not found.`));
    process.exit(1);
  }
  if (!stateB) {
    console.error(pc.red(`Run "${runIdB}" not found.`));
    process.exit(1);
  }

  const diff = compareRuns(stateA, stateB);

  if (opts.json) {
    console.log(JSON.stringify(diff, null, 2));
  } else {
    console.log(pc.bold(`Comparing ${runIdA} → ${runIdB}`));
    console.log(`Goal: ${diff.goalIdA}`);
    console.log(
      `Status: ${diff.statusDiff.a} → ${diff.statusDiff.b}${diff.statusDiff.changed ? '' : ' (unchanged)'}`,
    );
    console.log(
      `Iterations: ${diff.iterationDiff.a} → ${diff.iterationDiff.b} (${diff.iterationDiff.delta >= 0 ? '+' : ''}${diff.iterationDiff.delta})`,
    );
    console.log(
      `Checkpoints: ${diff.checkpointDiff.a} → ${diff.checkpointDiff.b} (${diff.checkpointDiff.delta >= 0 ? '+' : ''}${diff.checkpointDiff.delta})`,
    );
    console.log('');
    console.log(pc.bold('Criteria:'));
    for (const c of diff.criteriaDiff) {
      const iconA =
        c.statusA === 'pass' ? pc.green('✓') : c.statusA === 'fail' ? pc.red('✗') : pc.dim('○');
      const iconB =
        c.statusB === 'pass' ? pc.green('✓') : c.statusB === 'fail' ? pc.red('✗') : pc.dim('○');
      const arrow = c.changed ? pc.yellow('→') : ' ';
      console.log(`  ${iconA} ${arrow} ${iconB}  ${c.text}`);
    }
    console.log('');
    console.log(pc.bold(`Summary: ${diff.summary}`));
  }
}

function loadRun(runsDir: string, runId: string): RunState | null {
  const statusPath = resolve(runsDir, runId, 'status.json');
  if (!existsSync(statusPath)) return null;
  try {
    return JSON.parse(readFileSync(statusPath, 'utf-8')) as RunState;
  } catch {
    return null;
  }
}
