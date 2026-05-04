import { z } from "zod";
import { parse as parseYaml } from "yaml";
import type { Diagnostic } from "./diagnostic.js";
import { createError } from "./diagnostic.js";

export const SelectionExpectSchema = z.object({
  skill: z.string(),
});

export const SelectionTestSchema = z.object({
  description: z.string().min(1),
  input: z.string().min(1),
  keywords: z.array(z.string()).optional(),
  negative_keywords: z.array(z.string()).optional(),
  expect: SelectionExpectSchema,
});

export const SelectionTestsSchema = z.object({
  tests: z.array(SelectionTestSchema).min(1),
});

export type SelectionTest = z.infer<typeof SelectionTestSchema>;
export type SelectionTests = z.infer<typeof SelectionTestsSchema>;

export function parseSelectionTests(yamlContent: string, filePath: string): {
  success: true;
  tests: SelectionTests;
  diagnostics: Diagnostic[];
} | {
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
        createError("SELECTION_INVALID_YAML", `Failed to parse YAML in ${filePath}: ${String(err)}`, {
          file: filePath,
        }),
      ],
    };
  }

  if (!raw || (typeof raw === "object" && Object.keys(raw as object).length === 0)) {
    return {
      success: false,
      diagnostics: [
        createError("SELECTION_EMPTY", `Empty selection tests in ${filePath}`, { file: filePath }),
      ],
    };
  }

  const parsed = SelectionTestsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      diagnostics: parsed.error.issues.map((issue) =>
        createError("SELECTION_INVALID_SCHEMA", `${issue.path.join(".")}: ${issue.message}`, {
          file: filePath,
        }),
      ),
    };
  }

  return { success: true, tests: parsed.data, diagnostics: [] };
}
