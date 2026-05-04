import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import pc from 'picocolors';
import {
  parseIssueUrl,
  generateGoalFromIssue,
  generateGoalFromTitle,
  resolveSafe,
} from 'goalrun-core';

export async function fromIssueCommand(
  input: string,
  opts: { output?: string; json?: boolean },
): Promise<void> {
  const repoRoot = process.cwd();

  const issueInfo = parseIssueUrl(input);

  let yaml: string;

  if (issueInfo) {
    // It's a GitHub URL — generate a template with what we can extract
    yaml = generateGoalFromIssue({
      ...issueInfo,
      title: `Issue #${issueInfo.issueNumber} from ${issueInfo.owner}/${issueInfo.repo}`,
      body: `See: ${input}`,
    });
    console.log(
      pc.dim(`Parsed GitHub issue: ${issueInfo.owner}/${issueInfo.repo}#${issueInfo.issueNumber}`),
    );
  } else {
    // Treat as a title/description
    yaml = generateGoalFromTitle(input);
    console.log(pc.dim(`Generated goal from title: "${input}"`));
  }

  const outputPath =
    opts.output ??
    `.goalrun/goals/${input
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)}.yaml`;

  if (opts.json) {
    console.log(JSON.stringify({ input, has_issue_url: !!issueInfo, yaml }, null, 2));
  } else {
    const fullPath = resolveSafe(repoRoot, outputPath);
    mkdirSync(resolve(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, yaml, 'utf-8');
    console.log(pc.green(`Goal spec written to: ${outputPath}`));
    console.log(pc.dim('Review and edit the generated goal before using.'));
    console.log(pc.dim(`Next: goalrun verify ${outputPath}`));
  }
}
