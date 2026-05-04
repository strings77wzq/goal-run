import type { Diagnostic } from "@goalrun/core";
import pc from "picocolors";

export function formatText(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) {
    return pc.green("All checks passed. No issues found.");
  }

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");

  const lines: string[] = [];

  // Summary
  const parts: string[] = [];
  if (errors.length > 0) parts.push(pc.red(`${errors.length} error${errors.length > 1 ? "s" : ""}`));
  if (warnings.length > 0) parts.push(pc.yellow(`${warnings.length} warning${warnings.length > 1 ? "s" : ""}`));
  if (infos.length > 0) parts.push(pc.blue(`${infos.length} info`));
  lines.push(`Found ${parts.join(", ")}.`);
  lines.push("");

  // Print errors first
  for (const d of diagnostics) {
    const icon = d.severity === "error" ? pc.red("✖") : d.severity === "warning" ? pc.yellow("⚠") : pc.blue("ℹ");
    const loc = d.file ? (d.line ? ` ${d.file}:${d.line}` : ` ${d.file}`) : "";
    lines.push(`${icon} ${d.severity.toUpperCase()} ${d.code}${loc}`);
    lines.push(`  ${d.message}`);
    if (d.hint) {
      lines.push(`  ${pc.dim(`Hint: ${d.hint}`)}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export interface JsonReport {
  summary: {
    total: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  diagnostics: Array<{
    code: string;
    severity: string;
    message: string;
    file?: string;
    line?: number;
    hint?: string;
  }>;
}

export function formatJson(diagnostics: Diagnostic[]): string {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;
  const infos = diagnostics.filter((d) => d.severity === "info").length;

  const report: JsonReport = {
    summary: {
      total: diagnostics.length,
      errors,
      warnings,
      infos,
    },
    diagnostics: diagnostics.map((d) => {
      const item: JsonReport["diagnostics"][number] = {
        code: d.code,
        severity: d.severity,
        message: d.message,
      };
      if (d.file !== undefined) item.file = d.file;
      if (d.line !== undefined) item.line = d.line;
      if (d.hint !== undefined) item.hint = d.hint;
      return item;
    }),
  };

  return JSON.stringify(report, null, 2);
}
