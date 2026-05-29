import { resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { loadConfig } from '../utils/config.js';
import { resolveRunDir } from '../utils/run-dir.js';
import {
  autoAdvance,
  isTerminal,
  captureFullDiff,
  verifyDiffBoundaries,
  verifyCriteriaAutomatically,
  verifyEvidenceExists,
  checkDestructiveChange,
  enforceBreakingChangeProtocol,
  getChangedFiles,
  loadLessons,
  searchLessons,
  checkRoleBoundariesForFiles,
  PIPELINE_STAGES,
  type RunState,
  type PipelineStage,
} from 'goalrun-core';

export async function advanceCommand(
  runId: string,
  opts: { json?: boolean; force?: boolean },
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

  if (isTerminal(state.status)) {
    if (state.status === 'planned' && (!state.checkpoints || state.checkpoints.length === 0)) {
      console.log(pc.yellow(`Run "${runId}" was created without --loop.`));
      console.log(pc.dim('The advance/resume state machine requires --loop mode.'));
      console.log(pc.dim('Re-create the run: goalrun run <goal> --supervised --loop'));
      return;
    }
    console.log(pc.yellow(`Run "${runId}" is in terminal state: ${state.status}`));
    console.log(pc.dim("Nothing to advance. Use 'goalrun report' to view."));
    return;
  }

  // Determine diff root (worktree if isolated, else repo root)
  const diffRoot =
    state.isolated && state.worktree_path ? resolve(repoRoot, state.worktree_path) : repoRoot;

  // ── Real Verification Before Advancing ──

  const verificationResults: { name: string; passed: boolean; detail: string }[] = [];
  let verificationBlocked = false;

  // 1. Diff boundary check (if allowed_write_files defined)
  if (state.allowed_write_files && state.allowed_write_files.length > 0) {
    const boundaryResult = verifyDiffBoundaries(repoRoot, state.allowed_write_files, state.goal_id);
    verificationResults.push({
      name: 'diff_boundary',
      passed: boundaryResult.success,
      detail: boundaryResult.success
        ? 'All changes within declared boundaries'
        : boundaryResult.diagnostics.map((d) => d.message).join('; '),
    });
    if (!boundaryResult.success) {
      verificationBlocked = true;
    }
  }

  // 2. Destructive change check
  const changedFiles = getChangedFiles(repoRoot);
  for (const file of changedFiles.slice(0, 10)) {
    const destructiveResult = checkDestructiveChange(repoRoot, file);
    if (destructiveResult.isDestructive) {
      verificationResults.push({
        name: `destructive:${file}`,
        passed: false,
        detail: `Destructive change detected: ${destructiveResult.details.deletedLines} deleted lines, public API changed: ${destructiveResult.details.publicApiChanged}`,
      });
      verificationBlocked = true;
    }
  }

  // 3. TDD evidence check — BLOCK if tdd-change skill is used and evidence is missing
  const verificationDir = resolve(runDir, 'verification');
  const usesTddSkill = state.skills.includes('tdd-change');
  if (existsSync(verificationDir) || usesTddSkill) {
    const requiredEvidence = ['red-phase.txt'];
    const evidenceResult = verifyEvidenceExists(verificationDir, requiredEvidence);
    verificationResults.push({
      name: 'tdd_evidence',
      passed: evidenceResult.success,
      detail: evidenceResult.success
        ? 'TDD evidence captured'
        : evidenceResult.diagnostics.map((d) => d.message).join('; '),
    });
    // Block if TDD skill is used but evidence is missing (unless --force)
    if (!evidenceResult.success && usesTddSkill && !opts.force) {
      verificationBlocked = true;
    }
  }

  // 3b. Breaking change protocol — enforce full 4-step protocol
  for (const file of changedFiles.slice(0, 20)) {
    const protocol = enforceBreakingChangeProtocol(repoRoot, file);
    if (protocol.isDestructive) {
      verificationResults.push({
        name: `breaking_change:${file}`,
        passed: false,
        detail: `Breaking change detected — ${protocol.totalSteps}-step protocol required`,
      });
      // Write protocol instructions to verification dir
      if (!opts.force) {
        verificationBlocked = true;
        const protocolDir = resolve(runDir, 'verification');
        mkdirSync(protocolDir, { recursive: true });
        writeFileSync(
          resolve(protocolDir, `breaking-change-${file.replace(/\//g, '_')}.md`),
          protocol.instructions,
          'utf-8',
        );
      }
    }
  }

  // 3c. LESSONS.md search — warn about matching failure patterns
  const { lessons } = loadLessons(repoRoot);
  if (lessons.length > 0) {
    const keywords = state.skills.concat(state.criteria.map((c) => c.text.split(' ')[0] ?? ''));
    const { matches } = searchLessons(lessons, keywords);
    if (matches.length > 0) {
      verificationResults.push({
        name: 'lessons_match',
        passed: true,
        detail: `${matches.length} matching lesson(s) found — review before proceeding`,
      });
      // Write lessons to verification dir for agent reference
      const lessonsDir = resolve(runDir, 'verification');
      mkdirSync(lessonsDir, { recursive: true });
      writeFileSync(
        resolve(lessonsDir, 'matching-lessons.json'),
        JSON.stringify(matches, null, 2),
        'utf-8',
      );
    }
  }

  // 3d. Role boundary check — verify agent stayed within stage boundaries
  if (state.pipeline_stage && PIPELINE_STAGES.includes(state.pipeline_stage as PipelineStage)) {
    const stage = state.pipeline_stage as PipelineStage;
    const fileOps = changedFiles.map((f) => ({ path: f, operation: 'write' as const }));
    const roleResult = checkRoleBoundariesForFiles(stage, fileOps);
    if (!roleResult.allAllowed) {
      const violationCount = roleResult.violations.length;
      verificationResults.push({
        name: 'role_boundary',
        passed: false,
        detail: `${violationCount} file(s) outside role boundaries for stage "${state.pipeline_stage}"`,
      });
      if (!opts.force) {
        verificationBlocked = true;
      }
    }
  }

  // 4. Auto-verify criteria by running verification commands
  const verificationChecklistPath = resolve(runDir, 'verification-checklist.json');
  if (existsSync(verificationChecklistPath)) {
    try {
      const commands = JSON.parse(readFileSync(verificationChecklistPath, 'utf-8')) as string[];
      if (commands.length > 0) {
        const autoResult = verifyCriteriaAutomatically(repoRoot, commands);
        verificationResults.push({
          name: 'auto_verification',
          passed: autoResult.success,
          detail: autoResult.success
            ? 'All verification commands passed'
            : autoResult.diagnostics.map((d) => d.message).join('; '),
        });
        if (!autoResult.success) {
          verificationBlocked = true;
        }
      }
    } catch {
      // Failed to parse verification checklist
    }
  }

  // If verification blocked, do not advance
  if (verificationBlocked) {
    console.log(pc.red('Verification failed — advance blocked.'));
    console.log('');
    for (const r of verificationResults) {
      const icon = r.passed ? pc.green('✓') : pc.red('✗');
      console.log(`  ${icon} ${r.name}: ${r.detail}`);
    }
    console.log('');
    console.log(pc.dim('Fix the issues above and run advance again.'));
    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            run_id: runId,
            status: state.status,
            verification_blocked: true,
            results: verificationResults,
          },
          null,
          2,
        ),
      );
    }
    return;
  }

  // ── Semi-autonomous advance ──

  const result = autoAdvance(state);

  // Save all checkpoints with diff capture
  for (const cp of result.checkpoints) {
    const cpDir = resolve(runDir, 'checkpoints', cp.id);
    mkdirSync(cpDir, { recursive: true });
    writeFileSync(resolve(cpDir, 'status.json'), JSON.stringify(cp, null, 2), 'utf-8');

    // Capture diff at this checkpoint
    const diffResult = captureFullDiff(diffRoot);
    if (diffResult.success) {
      writeFileSync(resolve(cpDir, 'diff.patch'), diffResult.diff, 'utf-8');
    }
  }

  // Save verification results
  const verificationOutputPath = resolve(runDir, 'verification', 'advance-results.json');
  mkdirSync(resolve(runDir, 'verification'), { recursive: true });
  writeFileSync(
    verificationOutputPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results: verificationResults,
        blocked: verificationBlocked,
      },
      null,
      2,
    ),
    'utf-8',
  );

  // Save updated state
  const updatedState = {
    ...result.state,
    checkpoints: [...state.checkpoints, ...result.checkpoints],
  };
  writeFileSync(statusPath, JSON.stringify(updatedState, null, 2), 'utf-8');

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          run_id: runId,
          status: result.state.status,
          checkpoints: result.checkpoints.map((c) => c.id),
          stopped_at_gate: result.stopped_at_gate,
          verification: verificationResults,
        },
        null,
        2,
      ),
    );
  } else {
    // Show verification results
    if (verificationResults.length > 0) {
      console.log(pc.bold('Verification:'));
      for (const r of verificationResults) {
        const icon = r.passed ? pc.green('✓') : pc.yellow('⚠');
        console.log(`  ${icon} ${r.name}: ${r.detail}`);
      }
      console.log('');
    }

    // Show transitions
    for (const cp of result.checkpoints) {
      console.log(pc.dim(`  ${cp.id} → ${cp.status}${cp.summary ? ` — ${cp.summary}` : ''}`));
    }

    console.log('');
    const icon = isTerminal(result.state.status)
      ? result.state.status === 'completed'
        ? pc.green('✓')
        : pc.red('✗')
      : pc.cyan('◉');
    console.log(`${icon} Status: ${pc.bold(result.state.status)}`);

    if (result.stopped_at_gate) {
      console.log('');
      console.log(pc.yellow('Stopped at human gate.'));
      printHumanAction(result.state.status, runId);
    } else if (isTerminal(result.state.status)) {
      console.log('');
      if (result.state.status === 'completed') {
        console.log(pc.green('Run completed. All criteria passed.'));
        console.log(pc.dim(`Next: goalrun audit ${runId}`));
      } else if (result.state.status === 'failed') {
        console.log(pc.red('Run failed. Budget exhausted or unrecoverable error.'));
        console.log(pc.dim(`Next: goalrun report ${runId}`));
      }
    }
  }
}

function printHumanAction(status: string, runId: string): void {
  switch (status) {
    case 'waiting_for_user':
      console.log(pc.bold('Action required:'));
      console.log("  1. Review the agent's output in .goalrun/runs/" + runId + '/artifacts/');
      console.log('  2. Update criteria status if needed');
      console.log(pc.dim(`  3. Run: goalrun advance ${runId}`));
      break;
    case 'blocked_by_policy':
      console.log(pc.bold('Action required:'));
      console.log('  A policy gate was triggered. Review and approve/reject.');
      console.log(pc.dim(`  If approved: goalrun resume ${runId} --to waiting_for_user`));
      console.log(pc.dim(`  If rejected: goalrun stop ${runId}`));
      break;
  }
}
