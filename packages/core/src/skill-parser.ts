import { z } from 'zod';
import matter from 'gray-matter';
import type { Diagnostic } from './diagnostic.js';
import { createError, createWarning } from './diagnostic.js';

export const RiskEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const SkillMetadataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  risk: RiskEnum,
  permissions: z.array(z.string()).min(1),
  when_to_use: z.string().optional(),
  when_not_to_use: z.string().optional(),
});

export type SkillMetadata = z.infer<typeof SkillMetadataSchema>;

export interface ParseSuccess {
  success: true;
  metadata: SkillMetadata;
  body: string;
  diagnostics: Diagnostic[];
}

export interface ParseFailure {
  success: false;
  diagnostics: Diagnostic[];
}

export type ParseResult = ParseSuccess | ParseFailure;

const MIN_DESCRIPTION_LENGTH = 10;

export function parseSkillMd(content: string, filePath: string): ParseResult {
  const diagnostics: Diagnostic[] = [];

  let parsed: { data: unknown; content: string };

  try {
    parsed = matter(content);
  } catch {
    return {
      success: false,
      diagnostics: [
        createError('SKILL_NO_FRONTMATTER', `No valid YAML frontmatter found in ${filePath}`, {
          file: filePath,
          hint: 'Add YAML frontmatter between --- delimiters at the top of the file',
        }),
      ],
    };
  }

  if (!parsed.data || Object.keys(parsed.data).length === 0) {
    return {
      success: false,
      diagnostics: [
        createError('SKILL_NO_FRONTMATTER', `No frontmatter found in ${filePath}`, {
          file: filePath,
          hint: 'Add YAML frontmatter between --- delimiters at the top of the file',
        }),
      ],
    };
  }

  const schemaResult = SkillMetadataSchema.safeParse(parsed.data);

  if (!schemaResult.success) {
    const zodErrors = schemaResult.error.issues.map((issue) =>
      createError('SKILL_INVALID_FRONTMATTER', `${issue.path.join('.')}: ${issue.message}`, {
        file: filePath,
      }),
    );
    return { success: false, diagnostics: [...diagnostics, ...zodErrors] };
  }

  const metadata = schemaResult.data;

  // Check name matches directory name
  const dirName = filePath.split('/').slice(-2, -1)[0] ?? '';
  if (dirName && metadata.name !== dirName) {
    diagnostics.push(
      createWarning(
        'SKILL_NAME_MISMATCH',
        `Skill name "${metadata.name}" does not match directory name "${dirName}"`,
        {
          file: filePath,
          hint: `Rename the skill to "${dirName}" or move it to directory "${metadata.name}"`,
        },
      ),
    );
  }

  // Check description is not too short/generic
  if (metadata.description.length < MIN_DESCRIPTION_LENGTH) {
    diagnostics.push(
      createWarning(
        'SKILL_SHORT_DESCRIPTION',
        `Description is too short (${metadata.description.length} chars). Minimum recommended: ${MIN_DESCRIPTION_LENGTH}`,
        {
          file: filePath,
          hint: 'Add a more detailed description so agents can decide when to use this skill',
        },
      ),
    );
  }

  return { success: true, metadata, body: parsed.content, diagnostics };
}
