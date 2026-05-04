# AI Guide to GoalRun

You are an AI coding assistant (Claude Code, Codex, Cursor, or similar). This document explains how to help users work with GoalRun.

## What GoalRun Does (And Does NOT Do)

GoalRun is a **verification harness** — it validates goals, checks skills, enforces policy, and manages supervised runs. It does NOT execute code, does NOT call external LLMs, and does NOT auto-advance without human input.

## Core Rules (NEVER BREAK)

1. **Never execute blocked commands.** If a skill or goal contains a command in `.goalrun/policy.yaml` blocked_commands list, STOP and alert the user.
2. **Never bypass policy gates.** If a goal requires approval for `changes_public_api`, ask the user before modifying any public API.
3. **Never claim tests pass without evidence.** Show actual command output. Do not say "tests pass" unless you ran them and saw the output.
4. **Never ask users to paste secrets.** Tell them to use environment variables or a secret manager.
5. **Never modify files outside the goal's scope.** The budget fields define the blast radius.
6. **Never mark a criteria as "pass" without verification.** All criteria claims must have evidence in the artifacts directory.

## How to Help Users Set Up GoalRun

```bash
npm install -g goalrun    # Install globally
goalrun init              # Scaffold a project
goalrun skill install tdd-change code-review implementation-strategy
goalrun doctor            # Verify setup
```

## How to Help Users Create a Goal

```yaml
# .goalrun/goals/<goal-id>.yaml
id: my-task
title: Short description
goal: One-sentence description of the engineering task
skills:
  - implementation-strategy
  - tdd-change
  - code-review
criteria:
  - <measurable criterion 1>
  - <measurable criterion 2>
budget:
  max_iterations: 5
  max_changed_files: 20
  max_runtime_minutes: 60
policy:
  require_approval_for:
    - changes_public_api
    - deletes_files
verification:
  commands:
    - pnpm test
    - pnpm typecheck
```

## How to Help With verify Failures

| Code                        | Meaning                        | Fix                                                |
| --------------------------- | ------------------------------ | -------------------------------------------------- |
| `GOAL_MISSING_SKILL`        | Referenced skill not installed | `goalrun skill install <skill>`                    |
| `GOAL_INVALID_SCHEMA`       | Schema violation               | Fix the YAML to match the schema                   |
| `SKILL_NAME_MISMATCH`       | SKILL.md name != directory     | Rename one to match                                |
| `BLOCKED_COMMAND`           | Dangerous command detected     | Remove or replace                                  |
| `SECRET_*`                  | Possible secret in skill       | Remove the secret, rotate if exposed               |
| `SECURITY_PROMPT_INJECTION` | Possible prompt injection      | Review and sanitize the content                    |
| `CRITERIA_VAGUE`            | Criterion uses vague language  | Add measurable targets                             |
| `CRITERIA_UNVERIFIABLE`     | Subjective criterion           | Replace with testable condition                    |
| `INTEGRITY_HASH_MISMATCH`   | Skill content changed          | Reinstall: `goalrun skill install --force <skill>` |

## When You Receive a GoalRun Plan

1. Read the agent prompt carefully
2. Read each skill's SKILL.md from `.agent/skills/<name>/SKILL.md`
3. Follow skill workflows IN ORDER
4. **Stop at each policy gate** and request user approval
5. Run verification commands and capture output
6. Save evidence to `.goalrun/runs/<id>/artifacts/`
7. Report results against each criterion — with evidence

## Safety Checklist Before Reporting "Done"

- [ ] All criteria have evidence (test output, lint output, etc.)
- [ ] No policy gates were bypassed without user approval
- [ ] File changes are within the budget
- [ ] Verification commands were run and their output is saved
- [ ] No blocked commands were executed
- [ ] No secrets were printed in any output

## Policy Gate Protocol

When you encounter a policy gate:

1. **STOP** immediately
2. Tell the user: "I've hit a policy gate: [gate name]. This requires your approval."
3. Explain what triggered it and what approval is needed
4. **Do not proceed** until the user explicitly approves
5. If the user rejects, update the run status accordingly

GoalRun is the harness. You do the work. The human stays in control.
