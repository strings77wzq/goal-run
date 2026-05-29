import { resolve } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { getRepoInitFiles } from '../utils/templates.js';
import { detectEcosystem, generateBootstrapPlan } from 'goalrun-core';

interface EcosystemStatus {
  detected_at: string;
  components: Record<string, boolean>;
  missing: string[];
  bootstrap_actions: { component: string; command: string; priority: string }[];
}

export interface InitOptions {
  force?: boolean;
  dryRun?: boolean;
  skipEcosystem?: boolean;
}

export async function initCommand(opts: InitOptions): Promise<void> {
  const repoRoot = process.cwd();
  const files = getRepoInitFiles();

  const created: string[] = [];
  const skipped: string[] = [];

  for (const { dest, content } of files) {
    const fullPath = resolve(repoRoot, dest);

    if (existsSync(fullPath) && !opts.force) {
      skipped.push(dest);
      continue;
    }

    if (opts.dryRun) {
      created.push(dest);
      continue;
    }

    mkdirSync(resolve(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    created.push(dest);
  }

  if (opts.dryRun) {
    console.log(pc.cyan('[DRY RUN] Would create:'));
    for (const f of created) {
      console.log(`  ${pc.green('+')} ${f}`);
    }
    if (skipped.length > 0) {
      console.log(pc.dim('\nWould skip (already exist):'));
      for (const f of skipped) {
        console.log(`  ${pc.yellow('~')} ${f}`);
      }
    }
  } else {
    console.log(pc.green('GoalRun initialized!'));
    for (const f of created) {
      console.log(`  ${pc.green('+')} ${f}`);
    }
    if (skipped.length > 0) {
      console.log(pc.dim('\nSkipped (already exist, use --force to overwrite):'));
      for (const f of skipped) {
        console.log(`  ${pc.yellow('~')} ${f}`);
      }
    }
  }

  // ── Ecosystem Detection ──
  if (!opts.skipEcosystem) {
    console.log('');
    console.log(pc.bold('Ecosystem detection:'));
    const detection = detectEcosystem(repoRoot);
    const plan = generateBootstrapPlan(detection);

    const components = [
      { name: 'Superpowers', installed: detection.superpowers },
      { name: 'OMC', installed: detection.omc },
      { name: 'OpenSpec', installed: detection.openspec },
      { name: 'gstack', installed: detection.gstack },
      { name: 'ECC', installed: detection.ecc },
    ];

    for (const comp of components) {
      const icon = comp.installed ? pc.green('✓') : pc.yellow('○');
      const status = comp.installed ? pc.green('installed') : pc.yellow('missing');
      console.log(`  ${icon} ${comp.name} — ${status}`);
    }

    if (plan.missing.length > 0) {
      console.log('');
      console.log(pc.yellow(`${plan.missing.length} component(s) missing.`));
      console.log(pc.dim('Run `goalrun ecosystem bootstrap` to see installation instructions.'));
    } else {
      console.log('');
      console.log(pc.green('All ecosystem components installed!'));
    }

    // Save ecosystem detection results
    if (!opts.dryRun) {
      const ecosystemStatus: EcosystemStatus = {
        detected_at: new Date().toISOString(),
        components: {
          superpowers: detection.superpowers,
          omc: detection.omc,
          openspec: detection.openspec,
          gstack: detection.gstack,
          ecc: detection.ecc,
        },
        missing: plan.missing,
        bootstrap_actions: plan.actions.map((a) => ({
          component: a.component,
          command: a.command,
          priority: a.priority,
        })),
      };
      const ecoPath = resolve(repoRoot, '.goalrun', 'ecosystem.json');
      mkdirSync(resolve(ecoPath, '..'), { recursive: true });
      writeFileSync(ecoPath, JSON.stringify(ecosystemStatus, null, 2), 'utf-8');
    }
  }

  console.log('');
  console.log(pc.dim('\nNext steps:'));
  console.log(pc.dim('  goalrun skill install tdd-change code-review implementation-strategy'));
  console.log(
    pc.dim('  goalrun intel-scan                    # scan existing project (brownfield)'),
  );
  console.log(pc.dim('  goalrun ecosystem detect              # check ecosystem components'));
  console.log(pc.dim('  goalrun plan .goalrun/goals/example-fix-bug.yaml'));
}
