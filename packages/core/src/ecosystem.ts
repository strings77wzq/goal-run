import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Diagnostic } from './diagnostic.js';
import { createInfo, createWarning } from './diagnostic.js';

export interface EcosystemDetection {
  superpowers: boolean;
  omc: boolean;
  openspec: boolean;
  gstack: boolean;
  ecc: boolean;
  diagnostics: Diagnostic[];
}

export interface BootstrapPlan {
  missing: string[];
  actions: BootstrapAction[];
  diagnostics: Diagnostic[];
}

export interface BootstrapAction {
  component: string;
  description: string;
  command: string;
  priority: 'required' | 'recommended' | 'optional';
}

/**
 * Detect which ecosystem components are already installed in the project.
 */
export function detectEcosystem(repoRoot: string): EcosystemDetection {
  const diagnostics: Diagnostic[] = [];

  // Superpowers: check for .claude/skills with superpowers skills
  const superpowers =
    existsSync(resolve(repoRoot, '.claude/skills')) &&
    (() => {
      try {
        const skills = readFileSync(resolve(repoRoot, '.claude/settings.json'), 'utf-8');
        return skills.includes('superpowers') || skills.includes('superpowers:');
      } catch {
        return false;
      }
    })();

  // OMC (Oh-My-ClaudeCode): check for .omc directory or OMC config
  const omc =
    existsSync(resolve(repoRoot, '.omc')) ||
    existsSync(resolve(repoRoot, '.omx')) ||
    (() => {
      try {
        const settings = readFileSync(resolve(repoRoot, '.claude/settings.json'), 'utf-8');
        return settings.includes('oh-my-claudecode') || settings.includes('omc');
      } catch {
        return false;
      }
    })();

  // OpenSpec: check for openspec/ directory or .claude/skills with opsx
  const openspec =
    existsSync(resolve(repoRoot, 'openspec')) ||
    existsSync(resolve(repoRoot, '.claude/skills/opsx')) ||
    (() => {
      try {
        const settings = readFileSync(resolve(repoRoot, '.claude/settings.json'), 'utf-8');
        return settings.includes('openspec') || settings.includes('opsx:');
      } catch {
        return false;
      }
    })();

  // gstack: check for gstack commands in .claude/commands
  const gstack =
    existsSync(resolve(repoRoot, '.claude/commands/ship')) ||
    existsSync(resolve(repoRoot, '.claude/commands/review')) ||
    (() => {
      try {
        const settings = readFileSync(resolve(repoRoot, '.claude/settings.json'), 'utf-8');
        return settings.includes('gstack');
      } catch {
        return false;
      }
    })();

  // ECC (Enhanced Claude Code): check for ECC rules or config
  const ecc =
    existsSync(resolve(repoRoot, '.claude/rules')) ||
    (() => {
      try {
        const settings = readFileSync(resolve(repoRoot, '.claude/settings.json'), 'utf-8');
        return settings.includes('configure-ecc') || settings.includes('ecc');
      } catch {
        return false;
      }
    })();

  if (!superpowers) {
    diagnostics.push(
      createInfo('ECOSYSTEM_MISSING_SUPERPOWERS', 'Superpowers not detected', {
        hint: 'Install: Skill(skill:"superpowers:using-superpowers") — provides TDD, verification, code-review skills',
      }),
    );
  }
  if (!omc) {
    diagnostics.push(
      createInfo('ECOSYSTEM_MISSING_OMC', 'Oh-My-ClaudeCode not detected', {
        hint: 'Install: Skill(skill:"oh-my-claudecode:omc-setup") — provides ralph, ultrawork, team modes',
      }),
    );
  }
  if (!openspec) {
    diagnostics.push(
      createInfo('ECOSYSTEM_MISSING_OPENSPEC', 'OpenSpec not detected', {
        hint: 'Install: creates openspec/ for change lifecycle tracking (explore → propose → apply → archive)',
      }),
    );
  }
  if (!gstack) {
    diagnostics.push(
      createInfo('ECOSYSTEM_MISSING_GSTACK', 'gstack not detected', {
        hint: 'Install: git clone https://github.com/garrytan/gstack — provides /ship, /review, /qa, /cso roles',
      }),
    );
  }
  if (!ecc) {
    diagnostics.push(
      createInfo('ECOSYSTEM_MISSING_ECC', 'ECC rules not detected', {
        hint: 'Install: Skill(skill:"configure-ecc") — provides language-specific rules, hooks, and agents',
      }),
    );
  }

  return { superpowers, omc, openspec, gstack, ecc, diagnostics };
}

/**
 * Generate a bootstrap plan for missing ecosystem components.
 * Returns actions ordered by priority.
 */
export function generateBootstrapPlan(detection: EcosystemDetection): BootstrapPlan {
  const missing: string[] = [];
  const actions: BootstrapAction[] = [];
  const diagnostics: Diagnostic[] = [];

  if (!detection.superpowers) {
    missing.push('superpowers');
    actions.push({
      component: 'superpowers',
      description: 'Install Superpowers for TDD, verification, code-review, brainstorming skills',
      command: 'Skill(skill:"superpowers:using-superpowers")',
      priority: 'required',
    });
  }

  if (!detection.omc) {
    missing.push('omc');
    actions.push({
      component: 'omc',
      description: 'Install Oh-My-ClaudeCode for ralph/ultrawork/team execution modes',
      command: 'Skill(skill:"oh-my-claudecode:omc-setup")',
      priority: 'required',
    });
  }

  if (!detection.ecc) {
    missing.push('ecc');
    actions.push({
      component: 'ecc',
      description: 'Install ECC for language-specific rules, hooks, and agent orchestration',
      command: 'Skill(skill:"configure-ecc")',
      priority: 'recommended',
    });
  }

  if (!detection.openspec) {
    missing.push('openspec');
    actions.push({
      component: 'openspec',
      description: 'Install OpenSpec for change lifecycle tracking (explore → propose → apply → archive)',
      command: 'mkdir -p openspec && goalrun init --openspec',
      priority: 'recommended',
    });
  }

  if (!detection.gstack) {
    missing.push('gstack');
    actions.push({
      component: 'gstack',
      description: 'Install gstack for role-based review (/ship, /review, /qa, /cso)',
      command: 'git clone https://github.com/garrytan/gstack .claude/gstack',
      priority: 'optional',
    });
  }

  if (missing.length > 0) {
    diagnostics.push(
      createWarning(
        'ECOSYSTEM_INCOMPLETE',
        `${missing.length} ecosystem component(s) missing: ${missing.join(', ')}`,
        {
          hint: 'Run `goalrun ecosystem bootstrap` to auto-install missing components',
        },
      ),
    );
  }

  return { missing, actions, diagnostics };
}
