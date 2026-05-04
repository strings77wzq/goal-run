import { z } from 'zod';

export const SeverityEnum = z.enum(['error', 'warning', 'info']);

export const DiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: SeverityEnum,
  message: z.string().min(1),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  hint: z.string().optional(),
});

export type Diagnostic = z.infer<typeof DiagnosticSchema>;

export interface DiagnosticOpts {
  file?: string;
  line?: number;
  hint?: string;
}

export function createError(code: string, message: string, opts?: DiagnosticOpts): Diagnostic {
  return { code, severity: 'error', message, ...opts };
}

export function createWarning(code: string, message: string, opts?: DiagnosticOpts): Diagnostic {
  return { code, severity: 'warning', message, ...opts };
}

export function createInfo(code: string, message: string, opts?: DiagnosticOpts): Diagnostic {
  return { code, severity: 'info', message, ...opts };
}
