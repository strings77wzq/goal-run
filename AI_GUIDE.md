# AI Guide to GoalRun

You are an AI coding assistant (Claude Code, Codex, Cursor, or similar). This document explains how to help users work with GoalRun.

## What GoalRun Is

GoalRun is a **verification harness** that enforces the SDD+TDD pipeline for AI-assisted engineering:

```
OpenSpec proposal → architect review → TDD (red-green-refactor) → verify gates → code review → CI/CD
```

It validates goals, checks skills, enforces policy, generates AI-ready execution plans, and manages supervised runs with checkpointed audit trails. It does NOT execute code, does NOT call external LLMs, and does NOT auto-advance through human decision gates.

## Core Rules (NEVER BREAK)

1. **Never execute blocked commands.** If a skill or goal contains a command in `.goalrun/policy.yaml` blocked_commands list, STOP and alert the user.
2. **Never bypass policy gates.** If a goal requires approval for `changes_public_api`, ask the user before modifying any public API.
3. **Never claim tests pass without evidence.** Show actual command output.
4. **Never ask users to paste secrets.** Tell them to use environment variables or a secret manager.
5. **Never modify files outside the goal's scope.** The budget fields define the blast radius.
6. **Never mark a criteria as "pass" without verification evidence in the artifacts directory.**

## How to Help Users Set Up GoalRun

```bash
npm install -g goalrun@alpha       # Install (GoalRun is in alpha — use @alpha tag)
goalrun init                       # Scaffold .goalrun/, AGENTS.md, policy, example goal
goalrun skill install implementation-strategy tdd-change code-review
goalrun doctor                     # Verify setup
```

> If `goalrun` is not found after install: `npm config get prefix` → add `<prefix>/bin` to PATH.

## The SDD+TDD Pipeline

GoalRun enforces a full Spec-Driven + Test-Driven pipeline:

### Phase 1: SDD — Spec & Design

- User creates an OpenSpec proposal or writes a goal YAML
- `goalrun verify <goal>` — all 5 harnesses check the goal for completeness and safety
- `goalrun verify <goal> --format sarif` — output as SARIF v2.1.0 (GitHub Code Scanning)
- `goalrun verify <goal> --format junit` — output as JUnit XML (GitLab CI, Jenkins)
- `goalrun plan <goal>` — generates an AI-ready execution plan with risk summary

### Phase 2: TDD — Implementation

- Agent follows the plan using skills in order (implementation-strategy → tdd-change → code-review)
- `goalrun run <goal> --loop --isolated` — creates a supervised, checkpointed run
- Agent works in an isolated git worktree (`.goalrun/runs/<id>/worktree/`)
- `goalrun advance <run-id>` — semi-auto advance through states

### Phase 3: Verify — Quality Gates

- Verification commands run (pnpm test, typecheck, lint, etc.)
- CI/CD pipeline includes `goalrun verify` as a gate
- `goalrun report <run-id>` — detailed evidence report

## The Semi-Autonomous Loop

```
planned → waiting_for_agent → waiting_for_user (🛑 HUMAN) → verifying → completed
                                                          ↘ needs_revision → retry

blocked_by_policy (🛑 HUMAN) — approve or reject
```

Two human gates stop auto-advance:

- **waiting_for_user** — agent output needs human review
- **blocked_by_policy** — a policy gate was triggered

## How to Help Users Create a Goal

```yaml
# .goalrun/goals/<goal-id>.yaml
id: my-task
title: Short description of the engineering task
goal: One-sentence description of what needs to be done
skills:
  - implementation-strategy # SDD: plan the approach
  - tdd-change # TDD: red-green-refactor
  - code-review # Verify: structured review
criteria:
  - <specific measurable outcome 1>
  - <specific measurable outcome 2>
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

| Code                          | Meaning                        | Fix                                                |
| ----------------------------- | ------------------------------ | -------------------------------------------------- |
| `GOAL_MISSING_SKILL`          | Referenced skill not installed | `goalrun skill install <skill>`                    |
| `GOAL_INVALID_SCHEMA`         | Schema violation               | Fix YAML to match schema                           |
| `BLOCKED_COMMAND`             | Dangerous command detected     | Remove or replace                                  |
| `SECRET_*`                    | Possible secret in skill       | Remove the secret, rotate if exposed               |
| `PROMPT_INJECTION`            | Possible prompt injection      | Review and sanitize                                |
| `CRITERIA_VAGUE`              | Vague criterion language       | Add measurable targets                             |
| `CRITERIA_UNVERIFIABLE`       | Subjective criterion           | Replace with testable condition                    |
| `CRITERIA_MISSING_ERROR_PATH` | No error/edge case criteria    | Add error handling criteria                        |
| `CRITERIA_MISSING_REGRESSION` | No regression criteria         | Add regression test requirement                    |
| `INTEGRITY_HASH_MISMATCH`     | Skill content changed          | Reinstall: `goalrun skill install --force <skill>` |

## When You Receive a GoalRun Plan

1. Read the agent prompt carefully
2. **If the run is isolated**, `cd` into the worktree directory shown in the run output
3. Read each skill's SKILL.md from `.agent/skills/<name>/SKILL.md`
4. Follow skill workflows **IN ORDER** — strategy first, then TDD, then review
5. **Stop at each policy gate** and request user approval
6. Run verification commands and capture output
7. Save evidence to `.goalrun/runs/<id>/artifacts/`
8. Report results against each criterion — with specific evidence

## Safety Checklist Before Reporting "Done"

- [ ] All criteria have evidence (test output, lint output, etc.)
- [ ] No policy gates were bypassed without user approval
- [ ] File changes are within the budget
- [ ] Verification commands were run and output saved
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
