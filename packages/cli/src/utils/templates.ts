// ── Templates and built-in skills embedded as constants ──
// These are inlined at build time so the CLI works from any CWD,
// including npm global installs.

// ──── Repo templates ────

const AGENTS_MD = `# AGENTS.md

This file provides instructions for AI coding agents working in this repository.

## GoalRun Setup

This project uses GoalRun for goal-driven agent workflows. Run \`goalrun doctor\` to check the setup.

### Key files

- \`.goalrun/config.yaml\` — GoalRun configuration
- \`.goalrun/policy.yaml\` — Security policy and blocked commands
- \`.goalrun/goals/\` — Goal specifications
- \`.agent/skills/\` — Installed agent skills
- \`goalrun.lock\` — Lockfile tracking installed skills

### Common commands

- \`goalrun plan .goalrun/goals/<goal>.yaml\` — Generate an execution plan
- \`goalrun verify .goalrun/goals/<goal>.yaml\` — Validate a goal
- \`goalrun run .goalrun/goals/<goal>.yaml --supervised\` — Create a supervised run
- \`goalrun lint\` — Validate all GoalRun files
- \`goalrun test\` — Run skill selection tests
- \`goalrun doctor\` — Health check

### Creating a goal

1. Copy and modify \`.goalrun/goals/example-fix-bug.yaml\`
2. Fill in id, title, goal, skills, criteria, budget, policy, and verification
3. Run \`goalrun verify\` to check the goal is valid
4. Run \`goalrun plan\` to generate the agent prompt
5. Review the generated prompt before executing

### Safety rules

- Never bypass the policy gates in \`.goalrun/policy.yaml\`
- Never execute blocked commands
- Never claim tests pass without command output evidence
- Never ask the user to paste secrets or credentials
- Stop at each policy gate and request approval
`;

const CONFIG_YAML = `# GoalRun configuration
# See docs/concepts.md for full documentation

version: 1

# Skills directory relative to repo root
skills_dir: .agent/skills

# Goals directory relative to repo root
goals_dir: .goalrun/goals

# Policy file relative to repo root
policy_file: .goalrun/policy.yaml

# Selection tests file
selection_tests: .goalrun/tests/selection.yaml

# Runs output directory
runs_dir: .goalrun/runs

# Lockfile path
lockfile: goalrun.lock
`;

const POLICY_YAML = `# GoalRun security policy
# These rules are enforced by the policy harness during plan/verify/run

blocked_commands:
  - rm -rf
  - npm publish
  - pnpm publish
  - terraform apply
  - kubectl delete
  - gh release create
  - git push --force
  - curl | bash
  - wget -O - | sh

require_approval_for:
  - changes_public_api
  - deletes_files
  - modifies_auth_code
  - modifies_payment_code
  - modifies_infra
  - external_network_access
`;

const EXAMPLE_FIX_BUG_YAML = `id: example-fix-bug
title: Fix example bug with TDD
goal: >
  Fix the documented bug and add regression tests.

skills:
  - implementation-strategy
  - tdd-change
  - code-review

criteria:
  - regression test added
  - targeted tests pass
  - no public API change
  - final diff reviewed

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

const SELECTION_YAML = `# Selection tests for deterministic skill matching
# These tests verify that the right skills are selected for given inputs
# Run with: goalrun test

tests:
  - description: Bug fix selects tdd-change
    input: Fix the login bug in auth module
    expect:
      skill: tdd-change

  - description: Code review selects code-review
    input: Review the pull request changes
    expect:
      skill: code-review

  - description: Architecture change selects implementation-strategy
    input: Design the new caching architecture
    expect:
      skill: implementation-strategy

  - description: Documentation-only selects none
    input: Update the README with new badges
    expect:
      skill: none
`;

const SKILL_TEMPLATE_MD = `---
name: my-skill
description: A custom GoalRun skill
version: '0.1.0'
risk: low
permissions:
  - read_files
when_to_use: Describe when this skill should be used
when_not_to_use: Describe when this skill should NOT be used
---

# My Skill

Describe the skill's purpose, workflow, required outputs, and safety notes.
`;

// ──── Built-in skills ────

const TDD_CHANGE_MD = `---
name: tdd-change
description: Implement changes using strict test-driven development — red, green, refactor
version: '1.0.0'
risk: medium
permissions:
  - read_files
  - write_files
  - run_tests
when_to_use: |
  Use for bug fixes, features, and behavior-changing refactors where confidence
  in correctness is critical. Required when the goal specifies regression tests.
when_not_to_use: |
  Do not use for documentation-only changes, formatting-only changes, or changes
  where the existing test suite already provides complete coverage of the change.
---

# TDD Change

Implement code changes using the test-driven development cycle: Red, Green, Refactor.

## Workflow

1. **Understand the change**
   - Read the goal specification and implementation strategy (if provided)
   - Identify the specific behavior that needs to change
   - Understand the current behavior and expected new behavior

2. **Locate related tests**
   - Find existing tests that cover the affected code
   - Run the existing test suite to establish a baseline
   - If no tests exist for the affected behavior, note this as a test gap

3. **Write a failing test (RED)**
   - Write a test that describes the expected new behavior
   - If tests don't exist, write a test for the current behavior first, then modify it
   - Run the test to confirm it FAILS for the right reason
   - DO NOT proceed if the test passes without code changes

4. **Implement the minimal fix (GREEN)**
   - Write the smallest amount of code needed to make the failing test pass
   - Do not refactor during this step — just make it work
   - Run the specific test to confirm it passes
   - Run the broader test suite to check for regressions

5. **Refactor (REFACTOR)**
   - Clean up the implementation without changing behavior
   - Remove duplication, improve naming, simplify logic
   - Run all tests after each refactoring step
   - If tests fail, revert the last refactoring step

6. **Verify**
   - Run ALL tests, not just the targeted ones
   - Run goal verification commands (typecheck, lint)
   - Confirm no regression in unrelated tests

## Required Outputs

- The failing test (before implementation)
- The minimal implementation
- The refactored implementation (if applicable)
- Verification results: test output showing all tests pass

## Verification Expectations

- At least one new or modified test that specifically tests the change
- All existing tests continue to pass (no regressions)
- Goal verification commands all pass
- Diff is focused: no unrelated changes

## Safety Notes

- NEVER skip the RED phase. Always confirm the test fails first.
- NEVER modify tests to match broken code — fix the code, not the test.
- If a test starts passing without code changes, investigate. Something is wrong.
- Keep changes minimal. Do not refactor unrelated code.
- Stop if you cannot make the test pass within the goal's budget.max_iterations.
`;

const CODE_REVIEW_MD = `---
name: code-review
description: Review code changes for correctness, test coverage, security, performance, and maintainability
version: '1.0.0'
risk: low
permissions:
  - read_files
when_to_use: |
  Use after implementing a change, before merging a PR, or whenever you need
  an independent quality assessment of code changes.
when_not_to_use: |
  Do not use as a replacement for human code review on critical paths.
  Do not use for changes that have not been tested.
---

# Code Review

Perform a structured review of code changes against quality dimensions.

## Workflow

1. **Understand the change**
   - Read the goal specification and implementation strategy
   - Review the diff to understand what changed and why
   - Run the test suite to confirm tests pass

2. **Review dimensions**

   a. **Correctness**
   - Does the change correctly implement the goal?
   - Are edge cases handled?
   - Is error handling appropriate?
   - Are there any off-by-one errors, null reference risks, or race conditions?

   b. **Test Gaps**
   - Does the change include adequate tests?
   - Are edge cases tested?
   - Are negative paths tested? (what happens on failure?)
   - Is there test coverage for rollback/recovery?

   c. **Security**
   - Does the change introduce any OWASP Top 10 vulnerabilities?
   - Are there injection risks (SQL, command, path)?
   - Are secrets or credentials exposed?
   - Is input validated at system boundaries?

   d. **Performance**
   - Are there obvious performance issues (N+1 queries, large allocations)?
   - Is the algorithmic complexity appropriate for the data scale?
   - Are there blocking operations that could be async?

   e. **Maintainability**
   - Is the code clear and self-documenting?
   - Are names descriptive and consistent with the codebase?
   - Is there unnecessary abstraction or duplication?
   - Will a future developer understand this code?

   f. **Observability**
   - Are errors logged with enough context to debug?
   - Are important state transitions observable?

   g. **API Compatibility**
   - Are public APIs changed? If so, is the change backward-compatible?
   - Are deprecations properly signaled?

3. **Produce review report**
   - Summary: APPROVED / CHANGES REQUESTED / BLOCKED
   - Per-dimension findings with severity (error/warning/info)
   - Specific file:line references for each finding
   - Recommendations for each issue

## Required Outputs

- Review report with all dimensions assessed
- An overall verdict: APPROVED, CHANGES REQUESTED, or BLOCKED
- For each finding: severity, location, and recommendation

## Verification Expectations

- Every finding must reference a specific file and line
- BLOCKED verdict requires at least one error-level finding
- APPROVED verdict means no error-level findings
- Security findings are always at least warning severity

## Safety Notes

- This skill only reads files. It does not modify code.
- If a security vulnerability is found, mark it as error severity.
- Do not approve changes that delete or weaken existing tests.
- If tests are missing for the changed behavior, request changes.
`;

const IMPLEMENTATION_STRATEGY_MD = `---
name: implementation-strategy
description: Plan implementation strategy for medium-to-high risk changes before writing code
version: '1.0.0'
risk: low
permissions:
  - read_files
when_to_use: |
  Use before making changes that affect multiple files, public APIs, data models,
  auth code, payment systems, or any change with significant blast radius.
  Also use when the best approach is unclear or multiple options exist.
when_not_to_use: |
  Do not use for trivial changes like typo fixes, documentation-only updates,
  or changes where the implementation is already clearly specified and low-risk.
---

# Implementation Strategy

Analyze a proposed change and produce a structured implementation plan before writing code.

## Workflow

1. **Understand the goal**
   - Read the goal specification, criteria, and budget
   - Identify what problem is being solved and why
   - Note any constraints from policy or verification requirements

2. **Scope the impact**
   - Identify all files likely to be affected
   - Identify public API surfaces that may change
   - Check for existing tests related to the affected areas
   - Map dependencies between components

3. **Design the approach**
   - Enumerate at least two possible approaches with trade-offs
   - Select the approach with the best balance of correctness, safety, and maintainability
   - Design the test strategy: what tests need to be added or updated
   - Plan the rollback strategy: how to revert if something goes wrong

4. **Write the strategy document**
   - Summary of the problem and proposed solution
   - List of affected files (estimated)
   - Test strategy
   - Rollback plan
   - Risk assessment (low/medium/high per component)

## Required Outputs

- A strategy document (markdown) with all sections above
- Estimated changed file count (compare against goal budget.max_changed_files)
- Test coverage plan

## Verification Expectations

- Strategy MUST be reviewed by a human before implementation begins
- Estimated file count MUST NOT exceed goal budget.max_changed_files
- All identified public API changes MUST be flagged for approval
- No implementation code should be written during this phase

## Safety Notes

- This skill only reads files and produces a plan. It does not modify code.
- If the strategy identifies risks that cannot be mitigated, stop and escalate.
- Do not proceed to implementation if the strategy is incomplete.
`;

// ──── Public API ────

const SKILLS: Record<string, string> = {
  'tdd-change': TDD_CHANGE_MD,
  'code-review': CODE_REVIEW_MD,
  'implementation-strategy': IMPLEMENTATION_STRATEGY_MD,
};

export function getSkillTemplate(): string {
  return SKILL_TEMPLATE_MD;
}

export function getRepoInitFiles(): { dest: string; content: string }[] {
  return [
    { dest: 'AGENTS.md', content: AGENTS_MD },
    { dest: '.goalrun/config.yaml', content: CONFIG_YAML },
    { dest: '.goalrun/policy.yaml', content: POLICY_YAML },
    { dest: '.goalrun/goals/example-fix-bug.yaml', content: EXAMPLE_FIX_BUG_YAML },
    { dest: '.goalrun/tests/selection.yaml', content: SELECTION_YAML },
  ];
}

export function getBuiltinSkillContent(skillName: string): string | null {
  return SKILLS[skillName] ?? null;
}

export function getBuiltinSkillNames(): string[] {
  return Object.keys(SKILLS);
}
