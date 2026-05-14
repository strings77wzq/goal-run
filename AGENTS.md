# AGENTS.md — GoalRun Development Guide

Instructions for AI coding agents contributing to the GoalRun project itself.

## Project Identity

GoalRun is a **verification harness for AI-assisted engineering** that enforces the SDD+TDD pipeline:
**OpenSpec proposal → architect review → TDD implementation → verify gates → code review → CI/CD publish**

**GoalRun is:**

- A CLI for goal specification, skill management, and verification
- A harness system (5 harnesses) that validates skill quality and goal completeness
- A policy layer that gates high-risk operations
- A supervised loop system that creates checkpointed, auditable runs
- An OpenSpec-native SDD governance layer

**GoalRun is NOT:**

- An autonomous agent framework
- A skills marketplace
- A cloud service
- A replacement for Claude Code, Codex, or other agent runtimes
- A prompt library

## Development Commands

```bash
pnpm install         # Install all dependencies
pnpm test            # Run all tests (Vitest) — 297 tests, 29 files
pnpm lint            # ESLint — max-warnings=0
pnpm typecheck       # TypeScript type checking — tsc --build 5 packages
pnpm build           # Build all packages — tsup ESM bundles
pnpm format          # Prettier check
```

## SDD+TDD Workflow

GoalRun itself follows the same SDD+TDD pipeline it enforces:

1. **SDD** — OpenSpec proposal + specs define the change contract
2. **Architect review** — Security, performance, reusability audit
3. **TDD** — Red (write failing test) → Green (minimal fix) → Refactor
4. **Verify** — Full quality gates: test, typecheck, lint, format, build
5. **CI/CD** — GitHub Actions runs `goalrun verify` as CI gate

The project's own SDD goal: `.goalrun/goals/sdd-tdd-workflow.yaml`
Run `goalrun verify .goalrun/goals/sdd-tdd-workflow.yaml` to check compliance.

## TDD Rules

1. Write tests FIRST — confirm they fail (RED)
2. Write minimal implementation to pass (GREEN)
3. Refactor without changing behavior (REFACTOR)
4. Never write implementation code before tests
5. Every core module must have unit tests
6. CLI must have integration tests

## Security Rules

1. All file writes must be constrained to repo root — no path traversal
2. Never execute goal verification commands — only validate and report
3. Secret scan uses text patterns only — never print matched secrets
4. Never read .env files
5. All tests must pass without network access
6. Non-zero exit codes for errors, zero for warnings-only

## Package Architecture

- `packages/core` — Models, schemas (Zod), safe FS (resolveSafe), skill parser, lockfile
- `packages/security` — Policy validation, secret scan, blocked command detection
- `packages/harness` — 5 harnesses: static, selection, goal, policy, criteria, report
- `packages/reporter` — Text (picocolors) and JSON output formatting
- `packages/cli` — Commander-based CLI (18+ commands, tsup-bundled ESM, 246KB self-contained)
- `skills/` — Built-in skill source definitions (copied to `.agent/skills/` on install)
- `templates/` — Scaffold templates for `goalrun init`
- `scripts/` — Release pipeline scripts (check-versions, pack, install-smoke, verify-tags)

## Documentation Rules

- README.md first screen must express what GoalRun is and why it exists
- AI_GUIDE.md tells AI assistants how to help users with GoalRun
- AGENTS.md (this file) tells AI assistants how to develop GoalRun
- No emojis in code files
- No multi-paragraph docstrings

## Prohibited

- Do NOT call external LLM APIs
- Do NOT execute user project commands (test, build, etc.)
- Do NOT use a database
- Do NOT add a web UI
- Do NOT introduce unnecessary dependencies
- Do NOT skip test phases
- Do NOT use `TODO` instead of implementing core logic

## Verification Before Completion

All of these must pass:

- [ ] pnpm install
- [ ] pnpm test (297 tests, 29 files)
- [ ] pnpm lint (0 warnings)
- [ ] pnpm typecheck
- [ ] pnpm build (5 packages)
- [ ] pnpm format (prettier check)
- [ ] goalrun verify .goalrun/goals/sdd-tdd-workflow.yaml
