# GoalRun

**Goal-driven agent skills for software engineering.**

*Run tested agent skills against real software engineering goals.*

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/quick_start-3_steps-blue?style=for-the-badge" alt="Quick Start"></a>
  <a href="#what-goalrun-is"><img src="https://img.shields.io/badge/design-philosophy-orange?style=for-the-badge" alt="Design"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20">
  <img src="https://img.shields.io/badge/pnpm-%3E%3D9-blue" alt="pnpm >= 9">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT">
  <img src="https://img.shields.io/badge/tests-210_passing-brightgreen" alt="210 tests">
</p>

---

## Skip This README

Send this to your AI agent (Claude Code / Codex / Cursor) and let it figure everything out:

```
Read https://github.com/strings77wzq/goal-run and tell me
what GoalRun is, and how to use it in my project.
```

---

## Installation

### For Humans

**Don't install manually.** Copy this prompt, paste it to your AI agent (Claude Code, Codex CLI, Cursor, AmpCode — any of them):

```
Install and configure GoalRun:
1. git clone https://github.com/strings77wzq/goal-run.git
2. cd goal-run && pnpm install && pnpm build
3. Link it globally or add to PATH
4. In my project, run: goalrun init
5. Install built-in skills: goalrun skill install tdd-change code-review implementation-strategy
6. Run: goalrun doctor
```

Or if you insist on doing it yourself:

```bash
git clone https://github.com/strings77wzq/goal-run.git
cd goal-run && pnpm install && pnpm build
pnpm link --global              # makes 'goalrun' available globally
cd /your-project
goalrun init
goalrun skill install tdd-change code-review implementation-strategy
goalrun doctor
```

> Honestly, let the agent do it. Humans fat-finger configs.

### For AI Agents

```bash
curl -s https://raw.githubusercontent.com/strings77wzq/goal-run/main/AI_GUIDE.md
```

### Coming soon to npm

```bash
pnpm add -g goalrun              # one-liner (soon)
```

---

## Quick Start

```bash
# 1. Initialize GoalRun in your project
goalrun init

# 2. Install built-in skills
goalrun skill install tdd-change code-review implementation-strategy

# 3. Plan and verify your first goal
goalrun plan .goalrun/goals/example-fix-bug.yaml
goalrun verify .goalrun/goals/example-fix-bug.yaml

# 4. Create a supervised loop run
goalrun run .goalrun/goals/example-fix-bug.yaml --supervised --loop
goalrun status
goalrun resume <run-id>
goalrun report
```

**What just happened?** GoalRun validated your goal spec, checked all skills for quality and security, generated an AI-ready plan, and created a checkpointed supervised run — without calling any LLM or executing any code.

## What GoalRun Is

GoalRun is a **verification harness for agent-assisted engineering**.

| GoalRun does | GoalRun does NOT |
|---|---|
| Validate goals for completeness and safety | Execute your code |
| Verify skill quality (schema, permissions, no secrets) | Call external LLM APIs |
| Block dangerous commands in skills and goals | Run as a 24/7 autonomous agent |
| Generate structured plans for any AI assistant | Replace Claude Code / Codex / Cursor |
| Create checkpointed, resumable supervised runs | Be a skills marketplace or registry |
| Detect prompt injection and external URLs | Operate without human supervision |

**GoalRun is the harness. The AI does the work. You stay in control.**

## Who Should NOT Use GoalRun

- You want an **autonomous 24/7 agent** that runs unattended — GoalRun requires human supervision at every state transition
- You want a **one-click code generator** — GoalRun doesn't write code, it validates the agent that does
- You're looking for a **skills marketplace** — GoalRun ships with 3 built-in skills; it's not a registry
- You want to **replace Claude Code / Codex / Cursor** — GoalRun generates plans for them, not instead of them
- Your project has **no tests, no lint, no CI** — GoalRun's verification harness works best when you have verification commands to run

## Why GoalRun

The agent skills ecosystem is standardizing. GoalRun adds the **quality and safety layer**:

| Without GoalRun | With GoalRun |
|---|---|
| "Trust me, the skill is safe" | Static harness validates every SKILL.md |
| "It should work" | Goal harness checks 12 dimensions |
| "I hope it didn't run rm -rf" | Policy harness blocks dangerous commands |
| "What happened?" | Checkpointed runs with structured audit trail |
| "Can I resume?" | `goalrun resume` from last checkpoint |
| "Is this criteria verifiable?" | Criteria harness detects vague goals |

## The Supervised Loop

```
  planned ──→ waiting_for_agent ──→ waiting_for_user ──→ verifying
                 (share prompt)     (review output)    (run commands)
                                                      ┌────┴────┐
                                                 completed     needs_revision
                                                   ↑              │
                                                   └── resume ────┘
```

Every transition creates a checkpoint. You advance the state — GoalRun never auto-advances.

## Goal Spec Example

```yaml
id: fix-login-timeout
title: Fix login timeout bug
goal: >
  Fix session timeout causing logout after 5 min instead of 30 min.
skills:
  - implementation-strategy
  - tdd-change
  - code-review
criteria:
  - session timeout matches config (30 min)
  - timeout test added
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

## Built-in Skills

| Skill | Purpose |
|-------|---------|
| `implementation-strategy` | Plan medium/high-risk changes before coding |
| `tdd-change` | Implement with strict Red-Green-Refactor |
| `code-review` | Structured review across 7 quality dimensions |

## Commands

| Command | Description |
|---------|------------|
| `goalrun init` | Scaffold `.goalrun/`, `AGENTS.md`, policy config |
| `goalrun skill install <skills>` | Install skills with integrity verification |
| `goalrun lint` | Validate all GoalRun files |
| `goalrun test` | Run deterministic skill selection tests |
| `goalrun plan <goal>` | Generate execution plan + AI prompt |
| `goalrun verify <goal>` | Run all 5 harnesses on a goal |
| `goalrun run <goal> --supervised --loop` | Create checkpointed supervised run |
| `goalrun resume <run-id>` | Advance to next state |
| `goalrun status [run-id]` | Show run status and criteria |
| `goalrun stop <run-id>` | Stop a running loop |
| `goalrun report [run-id]` | Detailed run report |
| `goalrun doctor` | Health check |

## Security

- **Path containment**: All writes restricted to repo root
- **No command execution**: Verified but never executed
- **Secret detection**: 12 patterns, matched content never printed
- **Prompt injection detection**: 8 patterns for instruction override / jailbreak
- **External URL warnings**: curl/wget to non-allowlisted domains flagged
- **Lockfile integrity**: SHA-256 hashes verify installed skills
- **Offline**: All tests pass without network

## Development

```bash
git clone https://github.com/strings77wzq/goal-run.git
cd goal-run
pnpm install
pnpm test        # 210 tests passing
```

## What People Say This Is Not

> "Not a skills marketplace." — Correct. GoalRun validates skills, it doesn't sell them.
> "Not an autonomous agent." — Correct. GoalRun never auto-advances. You do.
> "Not a Claude Code replacement." — Correct. GoalRun generates plans for Claude Code to follow.

## Roadmap

| Phase | Status |
|-------|--------|
| P0 — Core CLI, 5 harnesses, 3 skills, 9 commands | ✅ |
| P1 — Lockfile integrity, security v2, criteria quality | ✅ |
| P2 — Supervised checkpoint loop (resume/status/stop) | ✅ |
| P3 — Git worktree isolation, diff capture, rollback | Planned |
| P4 — Adapter layer (Claude/Codex/Cursor variants) | Planned |

## License

MIT
