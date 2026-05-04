import { createError, createWarning, type Diagnostic, type PolicyConfig } from "goalrun-core";

const DANGEROUS_PERMISSIONS = [
  "execute_shell_commands",
  "delete_files",
  "network_access",
  "sudo",
  "modify_system",
];

export function validatePolicyConfig(
  config: PolicyConfig,
  filePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (config.blocked_commands.length === 0) {
    diagnostics.push(
      createWarning(
        "POLICY_NO_BLOCKED_COMMANDS",
        "Policy has no blocked commands defined",
        { file: filePath, hint: "Add at least common dangerous commands to blocked_commands" },
      ),
    );
  }

  if (config.require_approval_for.length === 0) {
    diagnostics.push(
      createWarning(
        "POLICY_NO_APPROVAL_GATES",
        "Policy has no approval gates defined",
        { file: filePath, hint: "Add approval categories to require_approval_for" },
      ),
    );
  }

  return diagnostics;
}

export function checkGoalAgainstPolicy(
  goalApprovalGates: string[],
  policyConfig: PolicyConfig,
  filePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const gate of goalApprovalGates) {
    if (!policyConfig.require_approval_for.includes(gate)) {
      diagnostics.push(
        createError(
          "GOAL_UNKNOWN_APPROVAL_GATE",
          `Goal references unknown approval gate "${gate}" not defined in policy`,
          { file: filePath, hint: `Available gates: ${policyConfig.require_approval_for.join(", ")}` },
        ),
      );
    }
  }

  return diagnostics;
}

export function checkSkillPermissions(
  skillName: string,
  permissions: string[],
  filePath: string,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (permissions.length === 0) {
    diagnostics.push(
      createWarning(
        "SKILL_NO_PERMISSIONS",
        `Skill "${skillName}" declares no permissions`,
        {
          file: filePath,
          hint: "Declare the permissions this skill requires (e.g., read_files, write_files)",
        },
      ),
    );
  }

  for (const perm of permissions) {
    if (DANGEROUS_PERMISSIONS.includes(perm)) {
      diagnostics.push(
        createWarning(
          "SKILL_DANGEROUS_PERMISSION",
          `Skill "${skillName}" requires dangerous permission: "${perm}"`,
          {
            file: filePath,
            hint: "Review whether this permission is truly necessary",
          },
        ),
      );
    }
  }

  return diagnostics;
}
