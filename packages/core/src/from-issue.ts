export interface IssueInfo {
  owner: string;
  repo: string;
  issueNumber: number;
  title: string;
  body: string;
  url: string;
}

export function parseIssueUrl(url: string): { owner: string; repo: string; issueNumber: number } | null {
  const match = /github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)\/issues\/(\d+)/.exec(url);
  if (!match) return null;
  return {
    owner: match[1]!,
    repo: match[2]!,
    issueNumber: parseInt(match[3]!, 10),
  };
}

export function generateGoalFromIssue(
  info: { owner: string; repo: string; issueNumber: number; title: string; body: string },
): string {
  const goalId = `${info.repo}-issue-${info.issueNumber}`;
  const title = info.title.replace(/[`"']/g, "").slice(0, 80);

  return `id: ${goalId}
title: ${title}
goal: >
  ${info.body.split("\n")[0]?.slice(0, 200) ?? info.title}

skills:
  - implementation-strategy
  - tdd-change
  - code-review

criteria:
  - regression test added for the fix
  - all existing tests continue to pass
  - no public API change unless explicitly required

budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60

policy:
  require_approval_for:
    - changes_public_api
    - deletes_files
    - modifies_auth_code

verification:
  commands:
    - pnpm test
    - pnpm typecheck
`;
}

export function generateGoalFromTitle(title: string): string {
  const goalId = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  return `id: ${goalId}
title: ${title}
goal: >
  ${title}

skills:
  - implementation-strategy
  - tdd-change
  - code-review

criteria:
  - implementation matches the requirement
  - tests added for new behavior
  - all existing tests continue to pass
  - no public API change unless required

budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60

policy:
  require_approval_for:
    - changes_public_api
    - deletes_files
    - modifies_auth_code

verification:
  commands:
    - pnpm test
    - pnpm typecheck
`;
}
