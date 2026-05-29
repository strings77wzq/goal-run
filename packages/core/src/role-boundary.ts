import type { PipelineStage } from './goal-schema.js';
import type { Diagnostic } from './diagnostic.js';
import { createWarning, createError } from './diagnostic.js';

/**
 * Operations that can be performed on files.
 */
export type FileOperation = 'read' | 'write' | 'delete';

/**
 * Role definition for a pipeline stage.
 * Defines what operations are allowed on what file types.
 */
export interface StageRole {
  stage: PipelineStage;
  description: string;
  allowedOperations: FileOperation[];
  allowedPaths: string[];
  deniedPaths: string[];
}

/**
 * Role boundaries for each pipeline stage.
 * Enforces the principle: each stage has a specific responsibility.
 */
const STAGE_ROLES: Record<PipelineStage, StageRole> = {
  change: {
    stage: 'change',
    description: 'Clarify vague ideas into change proposals. Read-only analysis.',
    allowedOperations: ['read'],
    allowedPaths: ['**/*'],
    deniedPaths: [],
  },
  requirement: {
    stage: 'requirement',
    description: 'Transform proposals into executable requirements. Read-only analysis.',
    allowedOperations: ['read'],
    allowedPaths: ['**/*'],
    deniedPaths: [],
  },
  design: {
    stage: 'design',
    description: 'Technical design with ADRs. Read-only analysis, writes only to design docs.',
    allowedOperations: ['read', 'write'],
    allowedPaths: ['*.md', '.goalrun/**/*.md', 'docs/**/*.md', 'openspec/**/*.md'],
    deniedPaths: ['src/**', 'lib/**', 'test/**', '__tests__/**'],
  },
  task: {
    stage: 'task',
    description: 'Break design into atomic tasks. Read-only analysis.',
    allowedOperations: ['read'],
    allowedPaths: ['**/*'],
    deniedPaths: [],
  },
  dev: {
    stage: 'dev',
    description: 'Execute tasks with TDD. Can read/write source and test files.',
    allowedOperations: ['read', 'write'],
    allowedPaths: [
      'src/**',
      'lib/**',
      'test/**',
      '__tests__/**',
      'packages/*/src/**',
      'packages/*/test/**',
    ],
    deniedPaths: [
      '.goalrun/policy.yaml',
      '.goalrun/goals/**',
      'openspec/config.yaml',
      '.github/workflows/**',
    ],
  },
  test: {
    stage: 'test',
    description: 'Run tests and verify. Read-only for source, write only for test reports.',
    allowedOperations: ['read', 'write'],
    allowedPaths: ['**/*', '.goalrun/runs/*/verification/**'],
    deniedPaths: ['.goalrun/policy.yaml', '.github/workflows/**'],
  },
  review: {
    stage: 'review',
    description: 'Code review. Strictly read-only. Cannot modify code.',
    allowedOperations: ['read'],
    allowedPaths: ['**/*'],
    deniedPaths: [],
  },
  integration: {
    stage: 'integration',
    description: 'UAT and archival. Read source, write only to archive/lessons.',
    allowedOperations: ['read', 'write'],
    allowedPaths: [
      '.goalrun/lessons.*',
      '.goalrun/runs/*/archive/**',
      'openspec/changes/archived/**',
    ],
    deniedPaths: ['src/**', 'lib/**', 'packages/*/src/**'],
  },
};

/**
 * Get the role definition for a pipeline stage.
 */
export function getStageRole(stage: PipelineStage): StageRole {
  return STAGE_ROLES[stage];
}

/**
 * Check if a file operation is allowed for the current pipeline stage.
 * Returns diagnostics if the operation violates role boundaries.
 */
export function checkRoleBoundary(
  stage: PipelineStage,
  filePath: string,
  operation: FileOperation,
): { allowed: boolean; diagnostics: Diagnostic[] } {
  const role = STAGE_ROLES[stage];
  const diagnostics: Diagnostic[] = [];

  // Check if operation is allowed at all
  if (!role.allowedOperations.includes(operation)) {
    diagnostics.push(
      createError(
        'ROLE_OPERATION_DENIED',
        `Stage "${stage}" cannot perform "${operation}" operations. Allowed: ${role.allowedOperations.join(', ')}`,
        {
          file: filePath,
          hint: `${role.description}. Switch to the appropriate pipeline stage for this operation.`,
        },
      ),
    );
    return { allowed: false, diagnostics };
  }

  // Check denied paths first (higher priority)
  for (const denied of role.deniedPaths) {
    if (matchesGlob(filePath, denied)) {
      diagnostics.push(
        createError(
          'ROLE_PATH_DENIED',
          `Stage "${stage}" cannot modify "${filePath}" — matches denied pattern "${denied}"`,
          {
            file: filePath,
            hint: `${role.description}. This file is protected at this stage.`,
          },
        ),
      );
      return { allowed: false, diagnostics };
    }
  }

  // Check allowed paths
  const isAllowed = role.allowedPaths.some((pattern) => matchesGlob(filePath, pattern));
  if (!isAllowed) {
    diagnostics.push(
      createWarning(
        'ROLE_PATH_NOT_ALLOWED',
        `File "${filePath}" is not in the allowed paths for stage "${stage}"`,
        {
          file: filePath,
          hint: `Allowed patterns: ${role.allowedPaths.join(', ')}`,
        },
      ),
    );
    return { allowed: false, diagnostics };
  }

  return { allowed: true, diagnostics };
}

/**
 * Check role boundaries for a list of changed files.
 * Used during advance to verify the agent stayed within its role.
 */
export function checkRoleBoundariesForFiles(
  stage: PipelineStage,
  changedFiles: { path: string; operation: FileOperation }[],
): {
  violations: { file: string; operation: FileOperation; diagnostics: Diagnostic[] }[];
  allAllowed: boolean;
} {
  const violations: { file: string; operation: FileOperation; diagnostics: Diagnostic[] }[] = [];

  for (const file of changedFiles) {
    const result = checkRoleBoundary(stage, file.path, file.operation);
    if (!result.allowed) {
      violations.push({
        file: file.path,
        operation: file.operation,
        diagnostics: result.diagnostics,
      });
    }
  }

  return { violations, allAllowed: violations.length === 0 };
}

/**
 * Simple glob matching. Supports:
 * - ** for directory traversal (zero or more path segments)
 * - * for single segment wildcard (no slash)
 * - Exact matches
 */
function matchesGlob(filePath: string, pattern: string): boolean {
  // Normalize paths
  const normalizedPath = filePath.replace(/^\.\//, '');
  const normalizedPattern = pattern.replace(/^\.\//, '');

  // Exact match
  if (normalizedPath === normalizedPattern) return true;

  // Convert glob to regex
  // **/ matches zero or more directory segments (including the slash)
  // * matches any characters except slash
  const regexStr = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '{{GLOBSTAR_SLASH}}')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR_SLASH\}\}/g, '(?:.*/)?')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');

  const regex = new RegExp(`^${regexStr}$`);
  return regex.test(normalizedPath);
}
