# GoalRun

**The verification harness that keeps AI agents honest.**

GoalRun validates goals, checks skills, blocks dangerous commands, generates AI-ready execution plans, and manages supervised runs with checkpointed audit trails — so agents can't claim "done" before your tests pass.

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20">
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9-blue" alt="pnpm >= 9">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
  <img src="https://img.shields.io/badge/tests-297_passing-brightgreen" alt="297 tests">
</p>

---

## What Is GoalRun

GoalRun is a **command-line verification harness** for AI-assisted software engineering. It sits between you and your AI agent (Claude Code, Codex, Cursor) and enforces quality gates at every step of the SDD+TDD pipeline.

**The full pipeline GoalRun enforces:**

```
OpenSpec proposal → architect review → TDD implementation → verify gates → code review → CI/CD publish
```

| GoalRun does                                  | GoalRun does NOT                  |
| --------------------------------------------- | --------------------------------- |
| Validate goals, skills, and policies          | Execute your code                 |
| Block dangerous commands                      | Call external LLM APIs            |
| Generate AI-ready execution plans             | Run as an autonomous agent        |
| Create checkpointed supervised runs           | Replace your AI assistant         |
| Detect secrets, prompt injection, unsafe URLs | Be a skills marketplace           |
| Enforce SDD+TDD pipeline constraints          | Operate without human supervision |

**GoalRun is the harness. The AI does the work. You stay in control.**

### Who Should Use GoalRun

- Teams using AI agents for production engineering who need quality gates
- Projects adopting **Spec-Driven Development** (SDD) with OpenSpec
- Anyone who wants agents to follow **Test-Driven Development** (TDD) with evidence
- Engineering leads who need auditable agent activity trails

### Who Should NOT Use GoalRun

- You want a fully autonomous 24/7 agent — GoalRun requires human gates
- You want a one-click code generator — GoalRun validates, it doesn't generate
- Your project has no tests, lint, or CI — GoalRun's harness pairs with verification commands

---

## Quick Start

```bash
# 1. Install
npm install -g goalrun@alpha

# 2. Initialize your project
cd your-project
goalrun init

# 3. Install built-in skills
goalrun skill install implementation-strategy tdd-change code-review

# 4. Verify the SDD+TDD workflow goal
goalrun verify .goalrun/goals/sdd-tdd-workflow.yaml

# 5. Plan and run
goalrun plan .goalrun/goals/sdd-tdd-workflow.yaml
goalrun run .goalrun/goals/sdd-tdd-workflow.yaml --loop --isolated
```

> **Alpha notice**: GoalRun is pre-1.0. APIs may change. Install with `@alpha` tag.

---

## How It Works

GoalRun enforces the SDD+TDD pipeline through **5 harnesses** and a **semi-autonomous state machine**:

### The 5 Harnesses

| Harness      | What It Checks                                                                            |
| ------------ | ----------------------------------------------------------------------------------------- |
| **Static**   | Skill quality — schema, permissions, secrets, blocked commands, prompt injection          |
| **Goal**     | Goal completeness — skill references, budget sanity, criteria quality, dangerous patterns |
| **Policy**   | Safety gates — blocked commands, approval requirements, skill permissions                 |
| **Criteria** | Criteria quality — vague language detection, unverifiable checks, missing error paths     |
| **Report**   | Plan generation — structured agent prompts, risk summaries, verification checklists       |

### The Semi-Autonomous Loop

GoalRun auto-advances through safe states. It pauses only at **2 human gates** — `waiting_for_user` (review agent output) and `blocked_by_policy` (approve/reject policy violation).

```
planned → waiting_for_agent → waiting_for_user 🛑 → verifying → completed
                                  ↓                         ↘ needs_revision
                           (review output)                       ↓
                                                          (fix + retry)

blocked_by_policy 🛑 — you decide: approve or reject
failed — budget exhausted, auto-stops
stopped — you end the run
```

**Every state transition creates an auditable checkpoint.**

---

## Built-in Skills

GoalRun ships with 3 skills covering the full SDD+TDD pipeline:

| Skill                     | Phase      | Description                                                                                               |
| ------------------------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| `implementation-strategy` | **SDD**    | Explore requirements, scope impact, produce structured implementation plans                               |
| `tdd-change`              | **TDD**    | Red-Green-Refactor: write failing test → minimal fix → refactor                                           |
| `code-review`             | **Verify** | 7-dimension review: correctness, tests, security, performance, maintainability, observability, API compat |

---

## Commands

```bash
# Project setup
goalrun init                          # Scaffold .goalrun/, AGENTS.md, policy, example goal
goalrun skill install <skills>        # Install skills with SHA-256 integrity verification
goalrun doctor                        # Health check

# SDD phase — spec & design
goalrun verify <goal>                 # Run all 5 harnesses on a goal
goalrun plan <goal>                   # Generate execution plan + AI prompt
goalrun from-issue <url>              # Convert GitHub issue → goal.yaml

# TDD phase — supervised execution
goalrun run <goal> --loop --isolated  # Create checkpointed run with worktree isolation
goalrun advance <run-id>              # Semi-auto advance — stops only at human gates
goalrun resume <run-id> --to <status> # Manual single-step state transition
goalrun status [run-id]               # View run state and criteria
goalrun stop <run-id>                 # Stop the run
goalrun report [run-id]               # Detailed run report
goalrun rollback <run-id>             # Discard changes (worktree remove or git reset)

# CI/CD phase — verification & release
goalrun audit <run-id>                # PR-ready audit report
goalrun compare <run-a> <run-b>       # Diff two runs
goalrun handoff <goal> --target <t>   # Runtime-specific prompt (claude/codex/cursor/opencode)
```

---

## Goal Spec Example

```yaml
id: fix-login-timeout
title: Fix login timeout bug
goal: Fix session timeout causing logout after 5 min instead of 30 min.
skills:
  - implementation-strategy
  - tdd-change
  - code-review
criteria:
  - session timeout matches config (30 min)
  - timeout regression test added
  - no public API change
  - existing auth tests pass
budget:
  max_iterations: 5
  max_changed_files: 10
  max_runtime_minutes: 60
policy:
  require_approval_for:
    - changes_public_api
    - modifies_auth_code
verification:
  commands:
    - pnpm test
    - pnpm typecheck
```

---

## Safety

- **No code execution**: GoalRun validates commands but never runs them
- **Path containment**: All writes and git operations restricted to repo root
- **Worktree isolation**: `--isolated` creates independent git worktrees; rollback only deletes GoalRun-managed branches
- **Structured git args**: Argument arrays, never shell interpolation
- **Secret detection**: 12 regex patterns — matched content never printed
- **Prompt injection detection**: 8 patterns for instruction override / jailbreak
- **Lockfile integrity**: SHA-256 hashes verify installed skills haven't been tampered with
- **Offline**: All tests pass without network access

---

## Development

```bash
git clone https://github.com/strings77wzq/goal-run.git
cd goal-run
pnpm install
pnpm test        # 297 tests passing
pnpm typecheck   # TypeScript strict
pnpm lint        # ESLint
pnpm build       # All 5 packages
```

---

## Roadmap

GoalRun is in **alpha** (0.1.0-alpha.6).

| Capability                                              | Status       |
| ------------------------------------------------------- | ------------ |
| Goal spec validation + 5 harnesses                      | ✅ Alpha     |
| Skill installation + integrity verification             | ✅ Alpha     |
| Security scanning (secrets, prompt injection, URLs)     | ✅ Alpha     |
| Supervised checkpoint loop (advance/resume/status/stop) | ✅ Alpha     |
| Git worktree isolation + diff capture + rollback        | ✅ Alpha     |
| Multi-runtime handoff (Claude/Codex/Cursor/OpenCode)    | ✅ Alpha     |
| OpenSpec SDD pipeline integration                       | ✅ Alpha     |
| npm install -g goalrun@alpha                            | ✅ Available |
| OpenSpec proposal → GoalRun goal bridge                 | 🔲 Planned   |

---

## License

MIT
