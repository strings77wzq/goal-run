#!/usr/bin/env node
import { checkVersionConsistency } from './release-utils.mjs';

try {
  const result = checkVersionConsistency(process.cwd());
  console.log(`All ${result.packages.length} packages at version ${result.version}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
