import { execSync } from 'node:child_process';
import type { Diagnostic } from './diagnostic.js';
import { createWarning, createInfo } from './diagnostic.js';

export interface AntiHallucinationResult {
  passed: boolean;
  diagnostics: Diagnostic[];
  checks: { name: string; passed: boolean; detail: string }[];
}

/**
 * Check if code references external APIs/libraries that haven't been verified to exist.
 * Prevents AI from hallucinating method names, function signatures, or package APIs.
 */
export function detectExternalApiReference(
  repoRoot: string,
  filePath: string,
  content: string,
): AntiHallucinationResult {
  const diagnostics: Diagnostic[] = [];
  const checks: { name: string; passed: boolean; detail: string }[] = [];

  // Extract import statements
  const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const importMatches: string[] = [];
  const requireMatches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(content)) !== null) importMatches.push(m[0]);
  while ((m = requireRegex.exec(content)) !== null) requireMatches.push(m[0]);

  const allImports = [...importMatches, ...requireMatches];

  for (const imp of allImports) {
    const pkgMatch =
      /from\s+['"]([^'"]+)['"]/.exec(imp) ?? /require\s*\(\s*['"]([^'"]+)['"]\s*\)/.exec(imp);
    if (!pkgMatch) continue;

    const pkgName = pkgMatch[1];
    if (!pkgName) continue;

    // Skip relative imports
    if (pkgName.startsWith('.') || pkgName.startsWith('/')) continue;

    // Check if the package exists in node_modules or is a Node.js built-in
    const basePkg = pkgName.startsWith('@')
      ? pkgName.split('/').slice(0, 2).join('/')
      : pkgName.split('/')[0];

    try {
      execSync(`node -e "require.resolve('${basePkg}')"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      checks.push({ name: `import:${basePkg}`, passed: true, detail: 'Package found' });
    } catch {
      // Check if it's in package.json
      try {
        const pkgJson = execSync(`cat package.json 2>/dev/null || echo "{}"`, {
          cwd: repoRoot,
          encoding: 'utf-8',
          timeout: 5000,
        });
        const hasInPkgJson = pkgJson.includes(`"${basePkg}"`) || pkgJson.includes(`'${basePkg}'`);

        if (hasInPkgJson) {
          checks.push({
            name: `import:${basePkg}`,
            passed: true,
            detail: 'In package.json (may need install)',
          });
        } else {
          diagnostics.push(
            createWarning(
              'UNVERIFIED_IMPORT',
              `Import "${basePkg}" not found in node_modules or package.json`,
              {
                file: filePath,
                hint: `Verify that "${basePkg}" exists before using it. Run: npm ls ${basePkg} or check package.json`,
              },
            ),
          );
          checks.push({ name: `import:${basePkg}`, passed: false, detail: 'Not found' });
        }
      } catch {
        checks.push({ name: `import:${basePkg}`, passed: false, detail: 'Check failed' });
      }
    }
  }

  // Check for suspicious method chains that might be hallucinated
  const suspiciousPatterns = [
    /\.getInstance\(\)/g,
    /\.getSingleton\(\)/g,
    /\.getRepository\(\)/g,
    /\.getService\(\)/g,
    /\.getManager\(\)/g,
  ];

  for (const pattern of suspiciousPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      diagnostics.push(
        createInfo(
          'SUSPICIOUS_METHOD_CHAIN',
          `Found ${matches.length} uses of ${pattern.source} — verify the method exists on the object`,
          {
            file: filePath,
            hint: 'AI agents sometimes hallucinate common method names. Verify the method exists on the target object type.',
          },
        ),
      );
    }
  }

  const passed = diagnostics.filter((d) => d.severity === 'error').length === 0;
  return { passed, diagnostics, checks };
}

/**
 * Run anti-hallucination checks on a codebase.
 * Verifies imports, checks for unverified external references, and
 * ensures code doesn't assume APIs exist without evidence.
 */
export function checkAntiHallucination(
  repoRoot: string,
  files: { path: string; content: string }[],
): AntiHallucinationResult {
  const allDiagnostics: Diagnostic[] = [];
  const allChecks: { name: string; passed: boolean; detail: string }[] = [];

  for (const file of files) {
    const result = detectExternalApiReference(repoRoot, file.path, file.content);
    allDiagnostics.push(...result.diagnostics);
    allChecks.push(...result.checks);
  }

  // Check for console.log/debug remnants
  for (const file of files) {
    const debugStatements = file.content.match(/console\.(log|debug|warn|error|info)\s*\(/g);
    if (debugStatements && debugStatements.length > 0) {
      allDiagnostics.push(
        createWarning(
          'DEBUG_STATEMENT_REMAINING',
          `File "${file.path}" contains ${debugStatements.length} console.* statement(s)`,
          {
            file: file.path,
            hint: 'Remove debug statements before committing. Use a proper logging library.',
          },
        ),
      );
    }
  }

  const passed = allDiagnostics.filter((d) => d.severity === 'error').length === 0;
  return { passed, diagnostics: allDiagnostics, checks: allChecks };
}
