import { isAbsolute, relative, resolve, sep } from 'node:path';
import { resolveSafe } from 'goalrun-core';

export function resolveRunDir(
  repoRoot: string,
  runsDirConfig: string,
  runId: string,
): string {
  const runsDir = resolveSafe(repoRoot, runsDirConfig);
  const runDir = resolve(runsDir, runId);
  const rel = relative(runsDir, runDir);

  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Run id "${runId}" resolves outside the runs directory`);
  }

  return runDir;
}
