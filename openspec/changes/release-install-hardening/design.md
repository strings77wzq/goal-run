## Context

GoalRun's source tree is ahead of the npm `alpha` CLI package, and the current release/install checks do not prove that a user can install the same CLI that the repository advertises. The root workspace package and CLI package also share the `goalrun` name, which makes filtered pack commands easy to mis-target. Local tool state under `.omx/` currently breaks `pnpm release:check` because Prettier scans it, while `openspec/` is ignored even though the project is now using OpenSpec as its SDD governance layer.

The change spans repository hygiene, release scripts, CI/CD, package smoke tests, and OpenSpec tracking. It must not perform a real npm publish or mutate npm dist-tags from this local session.

## Goals / Non-Goals

**Goals:**

- Make the documented local release gate pass without formatting runtime state.
- Ensure version consistency is checked by code that runs on Node 20 without extra runtime loaders.
- Replace the broken pack script with a package-scoped script that never packs the private workspace root.
- Add a non-publishing install smoke check that proves the built CLI package can be packed and invoked.
- Add manual, credential-gated GitHub release workflow coverage for npm publish and dist-tag verification.
- Make OpenSpec specs and change artifacts trackable while keeping `.omx/` and GoalRun run output ignored.
- Preserve previously completed runtime handoff and workflow reliability specs as baseline specs.

**Non-Goals:**

- Do not publish packages to npm from this session.
- Do not change public package names or introduce a new package manager.
- Do not execute user project verification commands from GoalRun.
- Do not add network-dependent checks to `pnpm release:check`; npm registry validation remains a release workflow/manual check.

## Decisions

1. **Use Node `.mjs` scripts for release gates.**

   Release helper scripts will be plain ESM JavaScript so Node 20 can execute them without `tsx` or TypeScript loader dependencies. The existing TypeScript version-check script will be replaced or wrapped by a Node-native script.

   Alternative considered: add `tsx` as a dev dependency and keep `scripts/check-versions.ts`. Rejected because the release gate is simpler and less fragile when it uses the runtime already required by the project.

2. **Scope pack/install smoke to `packages/*`, not package name filters.**

   `pnpm --filter goalrun` is ambiguous because the private workspace root and CLI package share a name. The release pack smoke will enumerate publishable package directories from `pnpm-workspace.yaml`/known package paths and run pack checks only for those packages.

   Alternative considered: rename the private root package. Rejected for this change because script-level scoping fixes the release risk without unnecessary package metadata churn.

3. **Install the packed CLI into a temporary project.**

   The install smoke will build packages, pack publishable workspace packages to a temporary directory, install the packed CLI tarball into a temporary project, and invoke the installed `goalrun` binary. It will not publish to npm or contact the registry for the CLI package under test.

   Alternative considered: only invoke `packages/cli/dist/index.js`. Rejected because that bypasses the public package surface and cannot catch broken `bin`, package metadata, or dependency packaging.

4. **Use executable dist-tag validation and gated publish scripts.**

   A read-only dist-tag validation script will compare a requested npm tag to expected package versions and exit non-zero on drift. Local `release:alpha` and `release:latest` scripts will run release checks, pack smoke, and install smoke before publish commands, while the GitHub workflow remains the preferred credentialed path.

   Alternative considered: leave dist-tag checks as documentation. Rejected because the problem being fixed is release drift; a docs-only check is not an enforceable gate.

5. **Use manual GitHub release workflow with explicit tag guard.**

   The release workflow will be `workflow_dispatch` only, require `NPM_TOKEN`, and require an explicit confirmation string before publishing to `latest`. It will use npm provenance permissions and run local release gates before publishing.

   Alternative considered: publish on every `main` push. Rejected because the project is alpha and release credentials should remain under an explicit human gate.

6. **Track OpenSpec but keep runtime state ignored.**

   `.gitignore` will stop ignoring `openspec/` so proposals, tasks, and baseline specs can be reviewed and committed. `.omx/`, `.goalrun/runs/`, build outputs, caches, and pack artifacts remain ignored.

## Risks / Trade-offs

- **Risk: installing local tarballs can be slow in CI** -> Mitigation: keep the smoke minimal: one temp project, install the packed CLI tarball, run `goalrun --version`, then clean up.
- **Risk: package tarballs depend on workspace dependency rewriting** -> Mitigation: pack all publishable packages first and install the CLI tarball from the packed artifacts so dependency metadata is exercised before publish.
- **Risk: manual release workflow can still be misused with the wrong tag** -> Mitigation: require explicit `latest` confirmation and run dist-tag verification after publish.
- **Risk: tracking OpenSpec changes adds more files to reviews** -> Mitigation: specs and tasks are the SDD contract; generated runtime state remains ignored.
- **Risk: scripts duplicate package path knowledge** -> Mitigation: centralize publishable package paths in a small helper module/script and test the scripts via CLI smoke tests.

## Migration Plan

1. Add release/install tests that fail against the current scripts and ignore settings.
2. Add `.prettierignore`, Node-native release scripts, and package script updates.
3. Add release workflow and update consumer Action template.
4. Add baseline OpenSpec specs and update `.gitignore`.
5. Run OpenSpec validation, release checks, install smoke, and full project verification.

Rollback is straightforward: revert this change. No external npm state is modified by local implementation.
