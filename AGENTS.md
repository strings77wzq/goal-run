# AGENTS.md — GoalRun Development Guide

Instructions for AI coding agents contributing to the GoalRun project itself.

## Project Identity

GoalRun is a goal-driven agent skills toolchain for software engineering.
We build, test, install, govern and run agent-native engineering workflows.

**GoalRun is:**
- A CLI for goal specification, skill management, and verification
- A harness system that validates skill quality and goal completeness
- A policy layer that gates high-risk operations
- A supervised run system that creates structured execution plans

**GoalRun is NOT:**
- An autonomous agent framework
- A skills marketplace
- A cloud service
- A replacement for Claude Code, Codex, or other agent runtimes
- A prompt library

## Development Commands

```bash
pnpm install         # Install all dependencies
pnpm test            # Run all tests (Vitest)
pnpm lint            # ESLint
pnpm typecheck       # TypeScript type checking
pnpm build           # Build all packages
```

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

- `packages/core` — Models, schemas (Zod), safe FS, skill parser, lockfile
- `packages/security` — Policy validation, secret scan, blocked command detection
- `packages/harness` — Static, selection, goal, policy, report harnesses
- `packages/reporter` — Text (picocolors) and JSON output formatting
- `packages/cli` — Commander-based CLI with 9 commands
- `skills/` — Built-in agent skills (implementation-strategy, tdd-change, code-review)
- `templates/` — Scaffold templates for `goalrun init`

## Documentation Rules

- README.md first screen must express what GoalRun is
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
- [ ] pnpm test
- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm build
