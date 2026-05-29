import { execSync } from 'node:child_process';
import type { Diagnostic } from './diagnostic.js';
import { createError, createWarning, createInfo } from './diagnostic.js';

export interface DestructiveChangeResult {
  isDestructive: boolean;
  diagnostics: Diagnostic[];
  details: {
    deletedLines: number;
    publicApiChanged: boolean;
    referencedFiles: string[];
  };
}

/**
 * Check if a diff constitutes a destructive change.
 * Destructive = deletes >= 5 non-empty lines OR changes public API signatures.
 */
export function checkDestructiveChange(
  repoRoot: string,
  filePath: string,
): DestructiveChangeResult {
  const diagnostics: Diagnostic[] = [];
  const details = { deletedLines: 0, publicApiChanged: false, referencedFiles: [] as string[] };

  try {
    const diff = execSync(`git diff HEAD -- "${filePath}"`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 10000,
    });

    // Count deleted non-empty lines
    const deletedLines = diff
      .split('\n')
      .filter((line) => line.startsWith('-') && !line.startsWith('---') && line.trim().length > 1)
      .length;

    details.deletedLines = deletedLines;

    if (deletedLines >= 5) {
      diagnostics.push(
        createError(
          'DESTRUCTIVE_CHANGE_DETECTED',
          `File "${filePath}" has ${deletedLines} deleted lines — requires review`,
          {
            file: filePath,
            hint: 'Destructive changes (>= 5 deleted lines) require: grep reference graph, user approval, and regression test coverage',
          },
        ),
      );
      details.publicApiChanged = true;
    }

    // Check if public API signatures changed (export function/class/interface)
    const removedExports = diff
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('-') &&
          !line.startsWith('---') &&
          /export\s+(function|class|interface|type|const)\s+/.test(line),
      );

    if (removedExports.length > 0) {
      details.publicApiChanged = true;
      diagnostics.push(
        createWarning(
          'PUBLIC_API_REMOVED',
          `Public API exports removed in "${filePath}"`,
          {
            file: filePath,
            hint: `Removed exports: ${removedExports.map((l) => l.slice(1).trim()).join('; ')}. Verify no callers depend on these.`,
          },
        ),
      );
    }

    // Find files that reference this file
    try {
      const basename = filePath.split('/').pop()?.replace(/\.(ts|js|tsx|jsx)$/, '') ?? '';
      if (basename) {
        const grepResult = execSync(
          `grep -rl "${basename}" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . 2>/dev/null | head -20 || true`,
          { cwd: repoRoot, encoding: 'utf-8', timeout: 10000 },
        ).trim();
        if (grepResult) {
          details.referencedFiles = grepResult.split('\n').filter((f) => f !== filePath);
        }
      }
    } catch {
      // grep not available or no matches
    }

    if (details.referencedFiles.length > 0 && details.publicApiChanged) {
      diagnostics.push(
        createInfo(
          'REFERENCE_GRAPH',
          `${details.referencedFiles.length} files reference symbols from "${filePath}"`,
          {
            file: filePath,
            hint: `Referenced by: ${details.referencedFiles.slice(0, 5).join(', ')}${details.referencedFiles.length > 5 ? '...' : ''}`,
          },
        ),
      );
    }

    const isDestructive = deletedLines >= 5 || details.publicApiChanged;
    return { isDestructive, diagnostics, details };
  } catch {
    // Not in git repo
    return { isDestructive: false, diagnostics: [], details };
  }
}

/**
 * Check if existing abstractions exist that could be reused instead of writing new code.
 * Searches for similar function/class names in the codebase.
 */
export function checkAbstractionReuse(
  repoRoot: string,
  targetName: string,
  targetDir: string,
): { exists: boolean; locations: string[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = [];
  const locations: string[] = [];

  try {
    // Search for similar names in the codebase
    const grepResult = execSync(
      `grep -rl "${targetName}" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" "${targetDir}" 2>/dev/null | head -10 || true`,
      { cwd: repoRoot, encoding: 'utf-8', timeout: 10000 },
    ).trim();

    if (grepResult) {
      locations.push(...grepResult.split('\n').filter(Boolean));
    }

    // Also search in common utility/helper/lib directories
    const commonDirs = ['utils', 'helpers', 'lib', 'shared', 'common', 'services'];
    for (const dir of commonDirs) {
      try {
        const utilGrep = execSync(
          `grep -rl "${targetName}" --include="*.ts" --include="*.js" "${dir}" 2>/dev/null | head -5 || true`,
          { cwd: repoRoot, encoding: 'utf-8', timeout: 5000 },
        ).trim();
        if (utilGrep) {
          locations.push(...utilGrep.split('\n').filter(Boolean));
        }
      } catch {
        // Directory doesn't exist
      }
    }

    const uniqueLocations = [...new Set(locations)];

    if (uniqueLocations.length > 0) {
      diagnostics.push(
        createInfo(
          'ABSTRACTION_REUSE_CANDIDATE',
          `Found ${uniqueLocations.length} existing references to "${targetName}" — consider reusing`,
          {
            hint: `Locations: ${uniqueLocations.slice(0, 5).join(', ')}. Import existing implementation instead of creating new one.`,
          },
        ),
      );
    }

    return { exists: uniqueLocations.length > 0, locations: uniqueLocations, diagnostics };
  } catch {
    return { exists: false, locations: [], diagnostics: [] };
  }
}
