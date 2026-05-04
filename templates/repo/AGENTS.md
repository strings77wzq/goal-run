# AGENTS.md

This file provides instructions for AI coding agents working in this repository.

## GoalRun Setup

This project uses GoalRun for goal-driven agent workflows. Run `goalrun doctor` to check the setup.

### Key files

- `.goalrun/config.yaml` — GoalRun configuration
- `.goalrun/policy.yaml` — Security policy and blocked commands
- `.goalrun/goals/` — Goal specifications
- `.agent/skills/` — Installed agent skills
- `goalrun.lock` — Lockfile tracking installed skills

### Common commands

- `goalrun plan .goalrun/goals/<goal>.yaml` — Generate an execution plan
- `goalrun verify .goalrun/goals/<goal>.yaml` — Validate a goal
- `goalrun run .goalrun/goals/<goal>.yaml --supervised` — Create a supervised run
- `goalrun lint` — Validate all GoalRun files
- `goalrun test` — Run skill selection tests
- `goalrun doctor` — Health check

### Creating a goal

1. Copy and modify `.goalrun/goals/example-fix-bug.yaml`
2. Fill in id, title, goal, skills, criteria, budget, policy, and verification
3. Run `goalrun verify` to check the goal is valid
4. Run `goalrun plan` to generate the agent prompt
5. Review the generated prompt before executing

### Safety rules

- Never bypass the policy gates in `.goalrun/policy.yaml`
- Never execute blocked commands
- Never claim tests pass without command output evidence
- Never ask the user to paste secrets or credentials
- Stop at each policy gate and request approval
