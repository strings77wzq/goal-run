import { resolve } from 'node:path';
import { existsSync, readdirSync, statSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import pc from 'picocolors';

interface ScanResult {
  techStack: string[];
  packageManager: string;
  testFramework: string;
  linting: string[];
  existingAbstractions: { name: string; location: string; type: string }[];
  moduleStructure: { path: string; description: string }[];
  namingConventions: { pattern: string; example: string }[];
  diagnostics: { severity: string; message: string }[];
}

export async function intelScanCommand(opts: {
  output?: string;
  json?: boolean;
}): Promise<void> {
  const repoRoot = process.cwd();

  console.log(pc.cyan('Scanning project...'));

  const result = scanProject(repoRoot);

  // Generate CONTEXT.md
  const contextMd = generateContextMd(result);

  // Generate ARCHITECTURE.md
  const architectureMd = generateArchitectureMd(result, repoRoot);

  // Write files
  const contextPath = resolve(repoRoot, '.goalrun', 'CONTEXT.md');
  const archPath = resolve(repoRoot, '.goalrun', 'ARCHITECTURE.md');

  mkdirSync(resolve(contextPath, '..'), { recursive: true });
  writeFileSync(contextPath, contextMd, 'utf-8');
  writeFileSync(archPath, architectureMd, 'utf-8');

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          context_path: contextPath,
          architecture_path: archPath,
          scan_result: result,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(pc.green('Intel scan complete!'));
    console.log(`  ${pc.green('+')} ${contextPath}`);
    console.log(`  ${pc.green('+')} ${archPath}`);
    console.log('');
    console.log(pc.bold('Detected:'));
    console.log(`  Tech stack: ${result.techStack.join(', ')}`);
    console.log(`  Package manager: ${result.packageManager}`);
    console.log(`  Test framework: ${result.testFramework}`);
    console.log(`  Abstractions found: ${result.existingAbstractions.length}`);
    console.log(`  Modules mapped: ${result.moduleStructure.length}`);
    if (result.diagnostics.length > 0) {
      console.log('');
      console.log(pc.yellow('Diagnostics:'));
      for (const d of result.diagnostics) {
        console.log(`  ${pc.yellow('⚠')} ${d.message}`);
      }
    }
    console.log('');
    console.log(pc.dim('Next: goalrun plan .goalrun/goals/<goal>.yaml'));
    console.log(pc.dim('The AI agent will read CONTEXT.md and ARCHITECTURE.md for project context.'));
  }
}

function scanProject(repoRoot: string): ScanResult {
  const result: ScanResult = {
    techStack: [],
    packageManager: 'unknown',
    testFramework: 'unknown',
    linting: [],
    existingAbstractions: [],
    moduleStructure: [],
    namingConventions: [],
    diagnostics: [],
  };

  // Detect package manager
  if (existsSync(resolve(repoRoot, 'pnpm-lock.yaml'))) {
    result.packageManager = 'pnpm';
  } else if (existsSync(resolve(repoRoot, 'yarn.lock'))) {
    result.packageManager = 'yarn';
  } else if (existsSync(resolve(repoRoot, 'package-lock.json'))) {
    result.packageManager = 'npm';
  } else if (existsSync(resolve(repoRoot, 'Cargo.toml'))) {
    result.packageManager = 'cargo';
  } else if (existsSync(resolve(repoRoot, 'go.mod'))) {
    result.packageManager = 'go';
  } else if (existsSync(resolve(repoRoot, 'requirements.txt')) || existsSync(resolve(repoRoot, 'pyproject.toml'))) {
    result.packageManager = 'pip';
  }

  // Detect tech stack from config files
  const techIndicators: { file: string; tech: string }[] = [
    { file: 'tsconfig.json', tech: 'TypeScript' },
    { file: 'package.json', tech: 'Node.js' },
    { file: 'Cargo.toml', tech: 'Rust' },
    { file: 'go.mod', tech: 'Go' },
    { file: 'requirements.txt', tech: 'Python' },
    { file: 'pyproject.toml', tech: 'Python' },
    { file: 'CMakeLists.txt', tech: 'C++' },
    { file: 'build.gradle', tech: 'Java/Kotlin' },
    { file: 'pubspec.yaml', tech: 'Dart/Flutter' },
  ];

  for (const { file, tech } of techIndicators) {
    if (existsSync(resolve(repoRoot, file))) {
      result.techStack.push(tech);
    }
  }

  // Detect test framework
  const pkgJsonPath = resolve(repoRoot, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.vitest) result.testFramework = 'vitest';
      else if (allDeps.jest) result.testFramework = 'jest';
      else if (allDeps.mocha) result.testFramework = 'mocha';
      else if (allDeps['@playwright/test']) result.testFramework = 'playwright';
      else if (allDeps.cypress) result.testFramework = 'cypress';

      // Detect linting
      if (allDeps.eslint) result.linting.push('eslint');
      if (allDeps.prettier) result.linting.push('prettier');
      if (allDeps['@typescript-eslint/parser']) result.linting.push('typescript-eslint');
      if (allDeps.stylelint) result.linting.push('stylelint');
    } catch {
      // Failed to parse package.json
    }
  }

  // Scan source structure
  const srcDirs = ['src', 'lib', 'app', 'packages'];
  for (const dir of srcDirs) {
    const dirPath = resolve(repoRoot, dir);
    if (existsSync(dirPath) && statSync(dirPath).isDirectory()) {
      result.moduleStructure.push(...scanDirectory(dirPath, repoRoot, dir));
    }
  }

  // Find existing abstractions (utils, helpers, services, shared)
  const abstractionDirs = ['src/utils', 'src/helpers', 'src/lib', 'src/shared', 'src/common', 'src/services', 'lib/utils', 'utils'];
  for (const dir of abstractionDirs) {
    const dirPath = resolve(repoRoot, dir);
    if (existsSync(dirPath)) {
      result.existingAbstractions.push(...findAbstractions(dirPath, repoRoot));
    }
  }

  // Detect naming conventions
  result.namingConventions = detectNamingConventions(repoRoot);

  return result;
}

function scanDirectory(
  dirPath: string,
  repoRoot: string,
  prefix: string,
): { path: string; description: string }[] {
  const modules: { path: string; description: string }[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const subPath = resolve(dirPath, entry.name);
        const relPath = `${prefix}/${entry.name}`;
        modules.push({ path: relPath, description: `Module: ${entry.name}` });
        // Limit depth to 2
        if (prefix.split('/').length < 3) {
          modules.push(...scanDirectory(subPath, repoRoot, relPath));
        }
      }
    }
  } catch {
    // Permission denied or other error
  }

  return modules;
}

function findAbstractions(
  dirPath: string,
  repoRoot: string,
): { name: string; location: string; type: string }[] {
  const abstractions: { name: string; location: string; type: string }[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
        const filePath = resolve(dirPath, entry.name);
        const content = readFileSync(filePath, 'utf-8');
        const relPath = filePath.replace(repoRoot + '/', '');

        // Extract exported functions and classes
        const funcMatches = content.match(/export\s+(?:async\s+)?function\s+(\w+)/g) ?? [];
        for (const match of funcMatches) {
          const name = match.replace(/export\s+(?:async\s+)?function\s+/, '');
          abstractions.push({ name, location: relPath, type: 'function' });
        }

        const classMatches = content.match(/export\s+class\s+(\w+)/g) ?? [];
        for (const match of classMatches) {
          const name = match.replace(/export\s+class\s+/, '');
          abstractions.push({ name, location: relPath, type: 'class' });
        }

        const typeMatches = content.match(/export\s+(?:type|interface)\s+(\w+)/g) ?? [];
        for (const match of typeMatches) {
          const name = match.replace(/export\s+(?:type|interface)\s+/, '');
          abstractions.push({ name, location: relPath, type: 'type' });
        }
      } else if (entry.isDirectory()) {
        abstractions.push(...findAbstractions(resolve(dirPath, entry.name), repoRoot));
      }
    }
  } catch {
    // Permission denied
  }

  return abstractions;
}

function detectNamingConventions(
  repoRoot: string,
): { pattern: string; example: string }[] {
  const conventions: { pattern: string; example: string }[] = [];

  // Check for common patterns
  const srcPath = resolve(repoRoot, 'src');
  if (existsSync(srcPath)) {
    try {
      const files = readdirSync(srcPath).filter((f) => !f.startsWith('.'));
      const hasKebab = files.some((f) => f.includes('-'));
      const hasCamel = files.some((f) => /^[a-z][a-zA-Z]*\./.test(f));
      const hasPascal = files.some((f) => /^[A-Z][a-zA-Z]*\./.test(f));

      if (hasKebab) conventions.push({ pattern: 'kebab-case files', example: files.find((f) => f.includes('-')) ?? '' });
      if (hasCamel) conventions.push({ pattern: 'camelCase files', example: files.find((f) => /^[a-z][a-zA-Z]*\./.test(f)) ?? '' });
      if (hasPascal) conventions.push({ pattern: 'PascalCase files', example: files.find((f) => /^[A-Z][a-zA-Z]*\./.test(f)) ?? '' });
    } catch {
      // Permission denied
    }
  }

  return conventions;
}

function generateContextMd(scan: ScanResult): string {
  const lines = [
    '# CONTEXT.md — Project Context for AI Agents',
    '',
    '> Auto-generated by `goalrun intel-scan`. Edit as needed.',
    '',
    '## Tech Stack',
    '',
    ...scan.techStack.map((t) => `- ${t}`),
    '',
    `## Package Manager: ${scan.packageManager}`,
    '',
    `## Test Framework: ${scan.testFramework}`,
    '',
    '## Linting',
    '',
    ...scan.linting.map((l) => `- ${l}`),
    '',
    '## Naming Conventions',
    '',
    ...scan.namingConventions.map((c) => `- ${c.pattern}: \`${c.example}\``),
    '',
    '## Existing Abstractions (DO NOT DUPLICATE)',
    '',
    '> Before writing new utility code, check if it already exists below.',
    '',
  ];

  // Group abstractions by location
  const byLocation = new Map<string, string[]>();
  for (const abs of scan.existingAbstractions) {
    const existing = byLocation.get(abs.location) ?? [];
    existing.push(`${abs.type}: ${abs.name}`);
    byLocation.set(abs.location, existing);
  }

  for (const [location, items] of byLocation) {
    lines.push(`### ${location}`);
    for (const item of items.slice(0, 10)) {
      lines.push(`- ${item}`);
    }
    if (items.length > 10) {
      lines.push(`- ... and ${items.length - 10} more`);
    }
    lines.push('');
  }

  lines.push('## Prohibited Changes', '');
  lines.push('> Do NOT modify these without explicit approval:');
  lines.push('- Public API exports');
  lines.push('- Auth/security code');
  lines.push('- Database schemas');
  lines.push('- CI/CD configuration');
  lines.push('');

  return lines.join('\n');
}

function generateArchitectureMd(scan: ScanResult, _repoRoot: string): string {
  const lines = [
    '# ARCHITECTURE.md — Project Architecture',
    '',
    '> Auto-generated by `goalrun intel-scan`. Edit as needed.',
    '',
    '## Module Structure',
    '',
  ];

  // Build a simple tree
  const topLevel = scan.moduleStructure.filter((m) => !m.path.includes('/', m.path.indexOf('/') + 1));
  for (const mod of topLevel) {
    lines.push(`- \`${mod.path}/\` — ${mod.description}`);
    const children = scan.moduleStructure.filter(
      (m) =>
        m.path.startsWith(mod.path + '/') &&
        m.path.split('/').length === mod.path.split('/').length + 1,
    );
    for (const child of children) {
      lines.push(`  - \`${child.path.split('/').pop()}/\``);
    }
  }

  lines.push('');
  lines.push('## Dependency Rules');
  lines.push('');
  lines.push('> Enforce these when reviewing code changes:');
  lines.push('- Utils/helpers must not import from feature modules');
  lines.push('- Feature modules may import from utils/helpers/shared');
  lines.push('- Circular dependencies are prohibited');
  lines.push('');

  lines.push('## Architecture Decision Records');
  lines.push('');
  lines.push('> Add ADRs for significant architectural decisions:');
  lines.push('```');
  lines.push('## ADR-001: [Decision Title]');
  lines.push('Context: ...');
  lines.push('Decision: ...');
  lines.push('Consequences: ...');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
