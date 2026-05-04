import { z } from 'zod';
import { parse as parseYaml } from 'yaml';
import type { Diagnostic } from './diagnostic.js';
import { createError } from './diagnostic.js';

export const PolicyConfigSchema = z.object({
  blocked_commands: z.array(z.string()),
  require_approval_for: z.array(z.string()),
});

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export function parsePolicyConfig(yamlContent: string, _filePath: string): PolicyConfig {
  const raw = parseYaml(yamlContent);
  return PolicyConfigSchema.parse(raw);
}

export const DEFAULT_POLICY: PolicyConfig = {
  blocked_commands: [
    'rm -rf',
    'npm publish',
    'pnpm publish',
    'terraform apply',
    'kubectl delete',
    'gh release create',
  ],
  require_approval_for: [
    'changes_public_api',
    'deletes_files',
    'modifies_auth_code',
    'modifies_payment_code',
    'modifies_infra',
    'external_network_access',
  ],
};

export function parsePolicyConfigSafe(
  yamlContent: string,
  filePath: string,
):
  | {
      success: true;
      config: PolicyConfig;
      diagnostics: Diagnostic[];
    }
  | {
      success: false;
      diagnostics: Diagnostic[];
    } {
  let raw: unknown;

  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    return {
      success: false,
      diagnostics: [
        createError('POLICY_INVALID_YAML', `Failed to parse YAML in ${filePath}: ${String(err)}`, {
          file: filePath,
        }),
      ],
    };
  }

  if (
    raw === null ||
    raw === undefined ||
    (typeof raw === 'object' && Object.keys(raw).length === 0)
  ) {
    return {
      success: false,
      diagnostics: [
        createError('POLICY_EMPTY', `Empty policy config in ${filePath}`, {
          file: filePath,
          hint: 'Add blocked_commands and require_approval_for lists',
        }),
      ],
    };
  }

  const parsed = PolicyConfigSchema.safeParse(raw);

  if (!parsed.success) {
    const diags = parsed.error.issues.map((issue) =>
      createError('POLICY_INVALID_SCHEMA', `${issue.path.join('.')}: ${issue.message}`, {
        file: filePath,
      }),
    );
    return { success: false, diagnostics: diags };
  }

  return { success: true, config: parsed.data, diagnostics: [] };
}
