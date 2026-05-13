## 1. Regression Tests First

- [x] 1.1 Add release script tests proving version consistency check succeeds with current packages and fails on a fixture with mismatched versions.
- [x] 1.2 Add release script tests proving pack/install smoke targets publishable `packages/*` packages and never packs the private workspace root.
- [x] 1.3 Add install smoke tests proving the packed CLI tarball is installed into a temporary project and the installed `goalrun --version` matches package metadata.
- [x] 1.4 Add release hygiene tests proving `.prettierignore` excludes `.omx/`, `.goalrun/runs/`, pack output, caches, and build artifacts while leaving `openspec/` trackable.
- [x] 1.5 Add template/workflow tests proving the consumer GitHub Action avoids unqualified `npx goalrun` and the release workflow contains manual publish, provenance, latest confirmation, environment protection, and executable dist-tag validation.

## 2. Release and Install Implementation

- [x] 2.1 Replace the TypeScript-only version checker with a Node 20-compatible release script and shared publishable-package discovery, then wire it into `pnpm release:check`.
- [x] 2.2 Implement a safe `release:pack` script that builds package tarballs only from publishable package directories and excludes root/runtime state.
- [x] 2.3 Implement an install smoke script that installs the packed CLI tarball into a temporary project, invokes the installed `goalrun` binary, and inspects CLI tarball contents.
- [x] 2.4 Add an executable read-only dist-tag verification script that exits non-zero on drift and never mutates npm state.
- [x] 2.5 Add `.prettierignore` and update `.gitignore` so OpenSpec assets are trackable while local runtime/build/cache artifacts stay ignored.
- [x] 2.6 Update the consumer GoalRun GitHub Action template to install a deterministic GoalRun package version before running checks.
- [x] 2.7 Add a manual GitHub release workflow with npm provenance, release checks, pack/install smoke, dist-tag verification, and explicit latest confirmation.
- [x] 2.8 Harden local `release:alpha` and `release:latest` scripts so alpha publish runs all preflights first and latest remains an explicit manual command path.

## 3. OpenSpec Baseline

- [x] 3.1 Keep the current `release-install-hardening` proposal, design, tasks, and specs under `openspec/changes/`.
- [x] 3.2 Add baseline specs under `openspec/specs/` for the completed runtime handoff and workflow reliability capabilities.
- [x] 3.3 Ensure `openspec list --specs` reports baseline specs and `openspec validate release-install-hardening --strict` passes.

## 4. Verification and Acceptance

- [x] 4.1 Run targeted release/install tests and confirm the new tests fail before implementation and pass after implementation.
- [x] 4.2 Run `pnpm release:check`, `pnpm release:pack`, and the install smoke command successfully.
- [x] 4.3 Run full `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`.
- [x] 4.4 Review changed files for security, performance, code reuse, boundary conditions, error handling, and test coverage.
- [x] 4.5 Record that no npm publish or npm dist-tag mutation was executed locally.
