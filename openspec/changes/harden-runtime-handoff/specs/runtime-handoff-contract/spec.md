## ADDED Requirements

### Requirement: Runtime-specific skill paths

The system SHALL generate handoff output that uses the configured skill path for the selected runtime in both shared context and per-skill instructions.

#### Scenario: Codex handoff uses Codex skill path

- **WHEN** a handoff is generated for the `codex` target
- **THEN** the handoff references `.codex/skills/<name>/SKILL.md` for skill loading and does not instruct the user to load the same skills from `.agent/skills/<name>/SKILL.md`

#### Scenario: Claude handoff uses Claude skill path

- **WHEN** a handoff is generated for the `claude` target
- **THEN** the handoff references `.claude/skills/<name>/SKILL.md` for skill loading and does not instruct the user to load the same skills from `.agent/skills/<name>/SKILL.md`

### Requirement: Canonical handoff sections

The system SHALL include a stable set of handoff sections for context, ordered skills, policy gates, verification checklist, risk summary, runtime instructions, and validation diagnostics.

#### Scenario: Target handoff preserves required workflow sections

- **WHEN** a handoff is generated for any supported target
- **THEN** the output contains the canonical workflow sections needed to execute, verify, and report the goal

### Requirement: Supported runtime validation

The system SHALL reject unknown handoff targets before producing output.

#### Scenario: Unknown target is rejected

- **WHEN** a handoff is requested for a target outside the supported runtime list
- **THEN** the command fails with a clear message listing supported targets
