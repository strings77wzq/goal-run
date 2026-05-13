## ADDED Requirements

### Requirement: OpenSpec assets are versioned

The system SHALL keep OpenSpec change artifacts and accepted baseline specs visible to git status so SDD decisions can be reviewed and committed.

#### Scenario: OpenSpec directory is trackable

- **WHEN** a new OpenSpec change or baseline spec is created
- **THEN** git status can show those files as tracked or untracked review artifacts

### Requirement: Runtime state remains ignored

The system SHALL continue to ignore local runtime state, generated run artifacts, build outputs, caches, and pack smoke output.

#### Scenario: OMX state is ignored

- **WHEN** local OMX state files are created under `.omx/`
- **THEN** formatting, release, and git review workflows do not require those files to be committed

### Requirement: Completed specs have baseline copies

The system SHALL preserve completed capability requirements under `openspec/specs/` after implementation so future changes can modify them by delta.

#### Scenario: Previous hardening specs are available as baseline

- **WHEN** future OpenSpec changes need to modify runtime handoff or workflow reliability behavior
- **THEN** baseline specs exist under `openspec/specs/runtime-handoff-contract/` and `openspec/specs/workflow-reliability-hardening/`
