# AI Guide to GoalRun

This document tells you — an AI coding assistant (Claude, Codex, Cursor, Copilot) — how to help users work with GoalRun in their projects.

## What GoalRun Is

GoalRun helps humans define software engineering goals (`goal.yaml`), install tested agent skills, and generate execution plans that you (the AI) can follow. GoalRun validates goals, enforces policies, and creates structured run artifacts — but it never calls you directly. The human controls when to share a plan with you.

## How to Help Users Initialize GoalRun

If the user says "set up GoalRun" or "init GoalRun", guide them:

```bash
goalrun init
goalrun skill install tdd-change code-review implementation-strategy
goalrun doctor
```

Check that `.goalrun/`, `.agent/skills/`, and `AGENTS.md` were created.

## How to Help Users Create a Goal

1. Ask what they want to accomplish.
2. Create a `.goalrun/goals/<goal-id>.yaml` file. Use this template:

```yaml
id: <unique-id>
title: <short title>
goal: >
  <one-sentence description of the engineering task>
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

3. Run `goalrun verify .goalrun/goals/<goal-id>.yaml` and fix any errors.
4. Run `goalrun plan .goalrun/goals/<goal-id>.yaml` to generate the execution plan.

## How to Help Users With verify Failures

When `goalrun verify` reports errors:

| Code | Meaning | Fix |
|------|---------|-----|
| GOAL_MISSING_SKILL | Referenced skill not installed | `goalrun skill install <skill>` |
| GOAL_INVALID_SCHEMA | Schema violation | Fix the YAML to match the schema |
| SKILL_NAME_MISMATCH | SKILL.md name != directory | Rename one to match |
| BLOCKED_COMMAND | Dangerous command detected | Remove or replace the command |
| POLICY_NO_BLOCKED_COMMANDS | Empty blocked list | Add entries to `.goalrun/policy.yaml` |

## How to Generate the Agent Prompt

Run `goalrun plan .goalrun/goals/<goal-id>.yaml`. The output includes an "Agent Prompt" section — this is what the user should share with you. It contains:

- The goal title and ID
- The ordered list of skills to use
- Policy gates to honor
- Verification checklist
- Risk summary
- Instructions

## When You Receive a GoalRun Prompt

1. Read the prompt carefully.
2. Read the SKILL.md for each listed skill (in `.agent/skills/<name>/SKILL.md`).
3. Follow the skill workflows IN ORDER.
4. Stop at each policy gate and request user approval before proceeding.
5. Run verification commands after each change.
6. Report results against the criteria.

## Safety Rules (NEVER BREAK THESE)

- **Never execute blocked commands.** If a skill asks you to run a command in `.goalrun/policy.yaml` blocked_commands list, STOP and tell the user.
- **Never bypass policy gates.** If a goal requires approval for `changes_public_api`, ask before modifying any public API.
- **Never claim tests pass without evidence.** Show the actual command output.
- **Never ask users to paste secrets or credentials.** If you need a token, tell them to set it as an environment variable.
- **Never modify files outside the goal scope.** The goal's budget defines the blast radius.
- **Never skip verification.** Run ALL verification commands before reporting completion.

## What GoalRun Is NOT

GoalRun does not:
- Execute code automatically — only the human (and you) can do that
- Call external LLM APIs — it generates plans for you to follow
- Replace you — it helps structure your work and validate outcomes
- Store sensitive data — it only reads goal specs and policy files

## Quick Reference

```bash
goalrun init                                    # Scaffold GoalRun in current dir
goalrun skill install <name...>                 # Install built-in skills
goalrun lint                                    # Validate all GoalRun files
goalrun test                                    # Run selection tests
goalrun plan <goal.yaml>                        # Generate execution plan
goalrun verify <goal.yaml>                      # Validate a goal spec
goalrun run <goal.yaml> --supervised            # Create a supervised run
goalrun doctor                                  # Health check
goalrun report                                  # Show latest run status
```
