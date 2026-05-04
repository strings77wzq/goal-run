import {
  parsePolicyConfigSafe,
  type Diagnostic,
  type PolicyConfig,
  type GoalSpec,
  createError,
} from 'goalrun-core';
import {
  validatePolicyConfig,
  checkGoalAgainstPolicy,
  checkSkillPermissions,
} from 'goalrun-security';
import { scanForBlockedCommands } from 'goalrun-security';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { parseSkillMd } from 'goalrun-core';

export interface PolicyHarnessInput {
  policyYamlPath: string;
  goalSpec?: GoalSpec;
  goalYamlPath?: string;
  skillDirs?: string[];
}

export interface PolicyHarnessOutput {
  success: boolean;
  config?: PolicyConfig;
  diagnostics: Diagnostic[];
}

export function runPolicyHarness(input: PolicyHarnessInput): PolicyHarnessOutput {
  const diagnostics: Diagnostic[] = [];

  if (!existsSync(input.policyYamlPath)) {
    diagnostics.push(
      createError('POLICY_FILE_NOT_FOUND', `Policy file not found: ${input.policyYamlPath}`),
    );
    return { success: false, diagnostics };
  }

  const content = readFileSync(input.policyYamlPath, 'utf-8');
  const parsed = parsePolicyConfigSafe(content, input.policyYamlPath);

  if (!parsed.success) {
    return { success: false, diagnostics: parsed.diagnostics };
  }

  const config = parsed.config;

  // Validate policy config completeness
  diagnostics.push(...validatePolicyConfig(config, input.policyYamlPath));

  // Check goal against policy
  if (input.goalSpec && input.goalYamlPath) {
    diagnostics.push(
      ...checkGoalAgainstPolicy(
        input.goalSpec.policy.require_approval_for,
        config,
        input.goalYamlPath,
      ),
    );

    // Scan goal spec for blocked commands
    const goalContent = input.goalSpec.goal + '\n' + input.goalSpec.criteria.join('\n');
    const goalBlocked = scanForBlockedCommands(
      goalContent,
      input.goalYamlPath,
      config.blocked_commands,
    );
    diagnostics.push(...goalBlocked);
  }

  // Check skill permissions
  if (input.skillDirs) {
    for (const skillDir of input.skillDirs) {
      const skillMdPath = `${skillDir}/SKILL.md`;
      if (existsSync(skillMdPath)) {
        const skillContent = readFileSync(skillMdPath, 'utf-8');
        const skillParsed = parseSkillMd(skillContent, skillMdPath);
        if (skillParsed.success) {
          diagnostics.push(
            ...checkSkillPermissions(
              skillParsed.metadata.name,
              skillParsed.metadata.permissions,
              skillMdPath,
            ),
          );

          // Scan skill content for blocked commands
          const skillBlocked = scanForBlockedCommands(
            skillParsed.body,
            skillMdPath,
            config.blocked_commands,
          );
          diagnostics.push(...skillBlocked);
        }
      }
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  return { success: !hasErrors, config, diagnostics };
}
