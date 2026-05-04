import { z } from 'zod';
import { createHash } from 'node:crypto';
import { createError, type Diagnostic } from './diagnostic.js';

export const LockfileSkillSchema = z.object({
  version: z.string(),
  installed_at: z.string(),
  source: z.literal('builtin'),
  sha256: z.string().length(64).optional(),
  installed_targets: z.array(z.string()).optional(),
  provenance: z.string().optional(),
});

export const LockfileSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.string(), LockfileSkillSchema),
});

export type Lockfile = z.infer<typeof LockfileSchema>;
export type LockfileSkill = z.infer<typeof LockfileSkillSchema>;

export function createLockfile(): Lockfile {
  return { version: 1, skills: {} };
}

export function computeSkillHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function addSkillToLockfile(
  lockfile: Lockfile,
  name: string,
  version: string,
  sha256?: string,
  installedTargets?: string[],
  provenance?: string,
): Lockfile {
  const entry: LockfileSkill = {
    version,
    installed_at: new Date().toISOString(),
    source: 'builtin' as const,
  };
  if (sha256) entry.sha256 = sha256;
  if (installedTargets) entry.installed_targets = installedTargets;
  if (provenance) entry.provenance = provenance;

  return {
    ...lockfile,
    skills: {
      ...lockfile.skills,
      [name]: entry,
    },
  };
}

export function removeSkillFromLockfile(lockfile: Lockfile, name: string): Lockfile {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [name]: _dropped, ...rest } = lockfile.skills;
  return { ...lockfile, skills: rest };
}

export function hasSkill(lockfile: Lockfile, name: string): boolean {
  return name in lockfile.skills;
}

export function getSkillInfo(lockfile: Lockfile, name: string): LockfileSkill | undefined {
  return lockfile.skills[name];
}

export function verifyIntegrity(
  lockfile: Lockfile,
  skillContents: Map<string, string>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, entry] of Object.entries(lockfile.skills)) {
    const content = skillContents.get(name);
    if (!content) {
      diagnostics.push(
        createError(
          'INTEGRITY_SKILL_NOT_FOUND',
          `Skill "${name}" is in lockfile but not found in skills directory`,
          { hint: "Run 'goalrun skill install' to reinstall this skill" },
        ),
      );
      continue;
    }

    if (entry.sha256) {
      const actualHash = computeSkillHash(content);
      if (actualHash !== entry.sha256) {
        diagnostics.push(
          createError(
            'INTEGRITY_HASH_MISMATCH',
            `Skill "${name}" content hash does not match lockfile`,
            {
              hint: "Skill content may have been modified. Run 'goalrun skill install --force' to reinstall.",
            },
          ),
        );
      }
    }
  }

  return diagnostics;
}
