import type { RunState } from "./run-state.js";

export interface RunDiff {
  runIdA: string;
  runIdB: string;
  goalIdA: string;
  goalIdB: string;
  criteriaDiff: {
    text: string;
    statusA: string;
    statusB: string;
    changed: boolean;
  }[];
  iterationDiff: { a: number; b: number; delta: number };
  checkpointDiff: { a: number; b: number; delta: number };
  statusDiff: { a: string; b: string; changed: boolean };
  summary: string;
}

export function compareRuns(a: RunState, b: RunState): RunDiff {
  // Merge criteria lists by text
  const allCriteria = new Map<string, { statusA: string; statusB: string }>();
  for (const c of a.criteria) {
    allCriteria.set(c.text, { statusA: c.status, statusB: "not_present" });
  }
  for (const c of b.criteria) {
    const existing = allCriteria.get(c.text);
    if (existing) {
      existing.statusB = c.status;
    } else {
      allCriteria.set(c.text, { statusA: "not_present", statusB: c.status });
    }
  }

  const criteriaDiff = [...allCriteria.entries()].map(([text, { statusA, statusB }]) => ({
    text,
    statusA,
    statusB,
    changed: statusA !== statusB,
  }));

  const improvedCriteria = criteriaDiff.filter(
    (c) =>
      (c.statusA === "pending" || c.statusA === "fail" || c.statusA === "not_present") &&
      c.statusB === "pass",
  ).length;

  const regressedCriteria = criteriaDiff.filter(
    (c) => c.statusA === "pass" && (c.statusB === "fail" || c.statusB === "pending"),
  ).length;

  const summaryParts: string[] = [];
  if (improvedCriteria > 0) summaryParts.push(`${improvedCriteria} criteria improved`);
  if (regressedCriteria > 0) summaryParts.push(`${regressedCriteria} criteria regressed`);
  if (improvedCriteria === 0 && regressedCriteria === 0) summaryParts.push("no criteria changes");

  return {
    runIdA: a.run_id,
    runIdB: b.run_id,
    goalIdA: a.goal_id,
    goalIdB: b.goal_id,
    criteriaDiff,
    iterationDiff: { a: a.iteration, b: b.iteration, delta: b.iteration - a.iteration },
    checkpointDiff: {
      a: a.checkpoints.length,
      b: b.checkpoints.length,
      delta: b.checkpoints.length - a.checkpoints.length,
    },
    statusDiff: { a: a.status, b: b.status, changed: a.status !== b.status },
    summary: summaryParts.join(", "),
  };
}
